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

	r.POST("/recipes", handlers.CreateRecipe)
	r.GET("/recipes/:id", handlers.GetRecipe)

	// If you need these endpoints later, implement them in handlers/recipes.go
	// r.PUT("/recipes/:id", handlers.UpdateRecipe)
	// r.DELETE("/recipes/:id", handlers.DeleteRecipe)

	r.POST("/upload", handlers.UploadImage)
	r.POST("/recipes/generate", handlers.GenerateRecipe)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
