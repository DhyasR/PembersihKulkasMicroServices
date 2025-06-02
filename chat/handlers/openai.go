package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"chatpage/firebase"
	"chatpage/models"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
)

type OpenAIRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float32   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type AIRecipe struct {
	Name          string       `json:"name"`
	Ingredients   []Ingredient `json:"ingredients"`
	Steps         []string     `json:"steps"`
	EstimatedTime string       `json:"estimated_time"`
}

type Ingredient struct {
	Name     string `json:"name"`
	Quantity string `json:"quantity"`
	Unit     string `json:"unit,omitempty"`
	Notes    string `json:"notes,omitempty"`
}

func getOpenAIKey() (string, error) {
	if key, err := os.ReadFile("/run/secrets/openai_key.txt"); err == nil {
		return strings.TrimSpace(string(key)), nil
	}

	return "", fmt.Errorf("OpenAI API key not found in secrets or environment variables")
}

func extractJSONFromResponse(response string) (string, error) {
	cleanJSON := strings.TrimPrefix(response, "```json")
	cleanJSON = strings.TrimPrefix(cleanJSON, "```")
	cleanJSON = strings.TrimSpace(cleanJSON)

	if !strings.HasPrefix(cleanJSON, "{") || !strings.HasSuffix(cleanJSON, "}") {
		return "", fmt.Errorf("invalid JSON format in AI response")
	}

	return cleanJSON, nil
}

func GenerateRecipe(c *gin.Context) {
	openaiKey, err := getOpenAIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "OpenAI API key configuration error",
			"details": err.Error(),
		})
		return
	}

	// Parse request body
	var request struct {
		Ingredients []string `json:"ingredients"`
		Cuisine     string   `json:"cuisine,omitempty"`
		Diet        string   `json:"diet,omitempty"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Build the prompt
	prompt := fmt.Sprintf(
		`You are a strict recipe generator. Only accept valid, edible, commonly available food ingredients. 
		If any input contains inappropriate, unethical, or non-food items (e.g., human meat, plastic, soap), you must refuse to generate the recipe and respond with an error message.

		Generate a detailed recipe using ONLY these ingredients: %v.  
		Cuisine style: %s.  
		Dietary restrictions: %s.

		Before proceeding:
		- Validate that all ingredients are real, safe, and commonly used in cooking.
		- Reject any harmful, illegal, unethical, or clearly non-edible inputs.
		- If invalid ingredients are detected, respond with:
		  {"error": "Invalid or unsafe ingredient(s) detected. Recipe not generated."}

		If all ingredients are valid, provide the recipe in this **EXACT** JSON format (no markdown, no extra text):

		{
		  "name": "Recipe name",
		  "ingredients": [
		    {
		      "name": "ingredient name",
		      "quantity": "amount",
		      "unit": "unit of measure",
		      "notes": "optional notes"
		    }
		  ],
		  "steps": ["step 1", "step 2"],
		  "estimated_time": "cooking time"
		}`,
		request.Ingredients,
		request.Cuisine,
		request.Diet,
	)

	openaiReq := OpenAIRequest{
		Model: "gpt-3.5-turbo",
		Messages: []Message{
			{
				Role:    "system",
				Content: "You are a helpful chef assistant that creates detailed recipes in strict JSON format.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.7,
		MaxTokens:   1000,
	}

	reqBody, err := json.Marshal(openaiReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// Call OpenAI API
	client := &http.Client{}
	req, err := http.NewRequest(
		"POST",
		"https://api.openai.com/v1/chat/completions",
		bytes.NewBuffer(reqBody),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create API request"})
		return
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+openaiKey)

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call OpenAI API"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{
			"error":  "OpenAI API error",
			"detail": string(body),
		})
		return
	}

	// Parse OpenAI response
	var openaiResp OpenAIResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse OpenAI response"})
		return
	}

	if len(openaiResp.Choices) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No response from AI"})
		return
	}

	// Extract and clean JSON from response
	jsonContent, err := extractJSONFromResponse(openaiResp.Choices[0].Message.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":       "Failed to extract JSON from AI response",
			"ai_response": openaiResp.Choices[0].Message.Content,
			"details":     err.Error(),
		})
		return
	}

	// Parse the recipe
	var aiRecipe AIRecipe
	if err := json.Unmarshal([]byte(jsonContent), &aiRecipe); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":        "Failed to parse recipe",
			"ai_response":  openaiResp.Choices[0].Message.Content,
			"json_content": jsonContent,
			"details":      err.Error(),
		})
		return
	}

	// Convert to our Recipe model
	recipe := models.Recipe{
		Name:          aiRecipe.Name,
		Ingredients:   make([]models.Ingredient, len(aiRecipe.Ingredients)),
		Steps:         aiRecipe.Steps,
		CookingTime:   aiRecipe.EstimatedTime,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		GeneratedByAI: true,
	}

	// Convert ingredients
	for i, ing := range aiRecipe.Ingredients {
		recipe.Ingredients[i] = models.Ingredient{
			Name:     ing.Name,
			Quantity: ing.Quantity,
			Unit:     ing.Unit,
			Notes:    ing.Notes,
		}
	}

	// Save to Firestore
	ctx := context.Background()
	docRef, _, err := firebase.FirestoreClient.Collection("recipes").Add(ctx, recipe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recipe"})
		return
	}

	// Update with generated ID
	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "id", Value: docRef.ID},
	})
	if err != nil {
		log.Printf("Failed to update recipe with ID: %v", err)
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":     docRef.ID,
		"recipe": recipe,
	})
}
