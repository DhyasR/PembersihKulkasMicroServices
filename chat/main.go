// main.go
package main

import (
	"context"
	"log"
	"os"
	"time"

	"chatpage/config"
	"chatpage/firebase"
	"chatpage/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	_ = config.LoadConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := firebase.InitFirebase(ctx); err != nil {
		log.Fatalf("Failed to initialize Firebase: %v", err)
	}
	defer firebase.FirestoreClient.Close()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Recipe CRUD endpoints
	r.POST("/recipes", handlers.CreateRecipe)
	r.GET("/recipes/:id", handlers.GetRecipe)
	r.PUT("/recipes/:id", handlers.UpdateRecipe)
	r.DELETE("/recipes/:id", handlers.DeleteRecipe)

	// Additional recipe endpoints
	r.GET("/recipes", handlers.ListRecipes)              // List all recipes with optional filters
	r.POST("/recipes/generate", handlers.GenerateRecipe) // AI recipe generation

	// File upload endpoint
	r.POST("/upload", handlers.UploadImage)

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "OK",
			"message":   "Chat service is running",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8100"
	}

	log.Printf("Chat service running on port %s", port)
	log.Printf("Available endpoints:")
	log.Printf("  POST /recipes - Create recipe")
	log.Printf("  GET /recipes - List recipes")
	log.Printf("  GET /recipes/:id - Get recipe by ID")
	log.Printf("  PUT /recipes/:id - Update recipe")
	log.Printf("  DELETE /recipes/:id - Delete recipe")
	log.Printf("  POST /recipes/generate - Generate recipe with AI")
	log.Printf("  POST /upload - Upload image")
	log.Printf("  GET /health - Health check")

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
