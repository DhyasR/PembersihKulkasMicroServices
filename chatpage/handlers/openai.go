// handlers/openai.go
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

func GenerateRecipe(c *gin.Context) {
	// Get OpenAI API key from environment
	openaiKey := os.Getenv("OPENAI_API_KEY")
	if openaiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OpenAI API key not configured"})
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
		`Create a detailed recipe using these ingredients: %v.
		Cuisine style: %s. Dietary restrictions: %s.
		Provide the recipe in JSON format with these exact field names:
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
		}
		Return ONLY the JSON object, without any additional text or explanation.`,
		request.Ingredients,
		request.Cuisine,
		request.Diet,
	)

	// Create OpenAI request
	openaiReq := OpenAIRequest{
		Model: "gpt-3.5-turbo",
		Messages: []Message{
			{
				Role:    "system",
				Content: "You are a helpful chef assistant that creates detailed recipes in JSON format.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.7,
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

	// Parse the recipe from AI response
	var aiRecipe AIRecipe
	if err := json.Unmarshal([]byte(openaiResp.Choices[0].Message.Content), &aiRecipe); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":       "Failed to parse recipe",
			"ai_response": openaiResp.Choices[0].Message.Content,
			"details":     err.Error(),
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
