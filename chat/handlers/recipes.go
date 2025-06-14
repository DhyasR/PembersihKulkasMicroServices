// handlers/recipes.go
package handlers

import (
	"context"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"chatpage/firebase"
	"chatpage/models"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func CreateRecipe(c *gin.Context) {
	var recipe models.Recipe
	if err := c.BindJSON(&recipe); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()

	recipe.CreatedAt = time.Now()
	recipe.UpdatedAt = time.Now()

	docRef, _, err := firebase.FirestoreClient.Collection("recipes").Add(ctx, recipe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create recipe"})
		return
	}

	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "id", Value: docRef.ID},
	})
	if err != nil {
		log.Printf("Failed to update recipe with ID: %v", err)
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      docRef.ID,
		"message": "Recipe created successfully",
	})
}

func GetRecipe(c *gin.Context) {
	id := c.Param("id")

	ctx := context.Background()
	doc, err := firebase.FirestoreClient.Collection("recipes").Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Recipe not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recipe"})
		return
	}

	var recipe models.Recipe
	if err := doc.DataTo(&recipe); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse recipe"})
		return
	}

	c.JSON(http.StatusOK, recipe)
}

func UpdateRecipe(c *gin.Context) {
	id := c.Param("id")

	var updateData models.Recipe
	if err := c.BindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	ctx := context.Background()
	docRef := firebase.FirestoreClient.Collection("recipes").Doc(id)

	// Check if recipe exists
	doc, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Recipe not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recipe"})
		return
	}

	// Get existing recipe to preserve certain fields
	var existingRecipe models.Recipe
	if err := doc.DataTo(&existingRecipe); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse existing recipe"})
		return
	}

	// Prepare update data - preserve ID, CreatedAt, and update UpdatedAt
	updateData.ID = id
	updateData.CreatedAt = existingRecipe.CreatedAt
	updateData.UpdatedAt = time.Now()

	// If certain fields are empty in update, preserve existing values
	if updateData.Name == "" {
		updateData.Name = existingRecipe.Name
	}
	if len(updateData.Ingredients) == 0 {
		updateData.Ingredients = existingRecipe.Ingredients
	}
	if len(updateData.Steps) == 0 {
		updateData.Steps = existingRecipe.Steps
	}
	if updateData.CookingTime == "" {
		updateData.CookingTime = existingRecipe.CookingTime
	}

	// Update the document
	_, err = docRef.Set(ctx, updateData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update recipe",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"message": "Recipe updated successfully",
		"recipe":  updateData,
	})
}

func DeleteRecipe(c *gin.Context) {
	id := c.Param("id")

	ctx := context.Background()
	docRef := firebase.FirestoreClient.Collection("recipes").Doc(id)

	// Check if recipe exists before deleting
	_, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Recipe not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recipe"})
		return
	}

	// Delete the recipe
	_, err = docRef.Delete(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete recipe",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"message": "Recipe deleted successfully",
	})
}

func ListRecipes(c *gin.Context) {
	ctx := context.Background()

	// Get query parameters for filtering
	userID := c.Query("user_id")
	cuisine := c.Query("cuisine")
	limit := 20 // Default limit

	// Build query
	query := firebase.FirestoreClient.Collection("recipes").OrderBy("created_at", firestore.Desc)

	// Apply filters if provided
	if userID != "" {
		query = query.Where("user_id", "==", userID)
	}
	if cuisine != "" {
		query = query.Where("cuisine", "==", cuisine)
	}

	// Apply limit
	query = query.Limit(limit)

	// Execute query
	docs, err := query.Documents(ctx).GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch recipes",
			"details": err.Error(),
		})
		return
	}

	// Parse results
	var recipes []models.Recipe
	for _, doc := range docs {
		var recipe models.Recipe
		if err := doc.DataTo(&recipe); err != nil {
			log.Printf("Failed to parse recipe %s: %v", doc.Ref.ID, err)
			continue
		}
		recipes = append(recipes, recipe)
	}

	c.JSON(http.StatusOK, gin.H{
		"recipes": recipes,
		"count":   len(recipes),
	})
}

func UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image uploaded"})
		return
	}

	filename := "uploads/" + uuid.New().String() + filepath.Ext(file.Filename)

	// Save file locally (in production, upload to Firebase Storage)
	if err := c.SaveUploadedFile(file, filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"image_url": filename,
	})
}
