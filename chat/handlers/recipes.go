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
		c.JSON(http.StatusNotFound, gin.H{"error": "Recipe not found"})
		return
	}

	var recipe models.Recipe
	if err := doc.DataTo(&recipe); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse recipe"})
		return
	}

	c.JSON(http.StatusOK, recipe)
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
