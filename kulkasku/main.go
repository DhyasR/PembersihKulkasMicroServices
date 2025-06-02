package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"bytes"
	"io"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"cloud.google.com/go/firestore"
	firebaseApp "firebase.google.com/go"
	"google.golang.org/api/option"
)

type Ingredient struct {
	ID       string    `json:"id"` // UUID or Firestore doc ID
	Name     string    `json:"name"`
	Quantity int       `json:"quantity"`
	Unit     string    `json:"unit"`    // e.g., "g", "ml", "pcs"
	UserID   string    `json:"user_id"` // Comes from query/session
	AddedAt  time.Time `json:"added_at"`
}

var firestoreClient *firestore.Client

func InitFirestore() *firestore.Client {
	ctx := context.Background()
	sa := option.WithCredentialsFile("firebase-adminsdk.json")

	app, err := firebaseApp.NewApp(ctx, nil, sa)
	if err != nil {
		log.Fatalf("Error initializing Firebase: %v", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("Error initializing Firestore client: %v", err)
	}

	return client
}

func AddIngredient(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	var ing Ingredient
	if err := json.NewDecoder(r.Body).Decode(&ing); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	ing.ID = uuid.New().String()
	ing.AddedAt = time.Now()

	_, err := firestoreClient.Collection("ingredients").Doc(ing.ID).Set(ctx, ing)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ing)
}

func GetIngredients(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userID := r.URL.Query().Get("user_id")

	if userID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	docs, err := firestoreClient.Collection("ingredients").Where("UserID", "==", userID).Documents(ctx).GetAll()
	if err != nil {
		http.Error(w, "Failed to fetch ingredients", http.StatusInternalServerError)
		return
	}

	var ingredients []Ingredient
	for _, doc := range docs {
		var ing Ingredient
		doc.DataTo(&ing)
		ingredients = append(ingredients, ing)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ingredients)
}

func DeleteIngredient(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := firestoreClient.Collection("ingredients").Doc(id).Delete(ctx)
	if err != nil {
		http.Error(w, "Failed to delete ingredient", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func GetRecipes(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userID := r.URL.Query().Get("user_id")

	if userID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	docs, err := firestoreClient.Collection("ingredients").Where("UserID", "==", userID).Documents(ctx).GetAll()
	if err != nil {
		http.Error(w, "Failed to fetch ingredients", http.StatusInternalServerError)
		return
	}

	var ingredients []Ingredient
	for _, doc := range docs {
		var ing Ingredient
		doc.DataTo(&ing)
		ingredients = append(ingredients, ing)
	}

	ingredientsJSON, _ := json.Marshal(ingredients)
	resp, err := http.Post("http://chatpage:5000/recipes", "application/json", bytes.NewBuffer(ingredientsJSON)) // Change port if needed
	if err != nil {
		http.Error(w, "Failed to contact chatpage", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func main() {
	firestoreClient = InitFirestore()
	defer firestoreClient.Close()

	router := mux.NewRouter()
	router.HandleFunc("/addingredients", AddIngredient).Methods("POST")
	router.HandleFunc("/getingredients", GetIngredients).Methods("GET")
	router.HandleFunc("/ingredients/{id}", DeleteIngredient).Methods("DELETE")
	router.HandleFunc("/recipes", GetRecipes).Methods("GET")
	router.HandleFunc("/health", HealthCheck).Methods("GET")

	log.Println("kulkasku service running on port 8200")
	log.Fatal(http.ListenAndServe(":8200", router))
}
