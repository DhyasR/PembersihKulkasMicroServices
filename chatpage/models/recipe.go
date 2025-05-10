package models

import (
	"time"
)

type Ingredient struct {
	Name     string `json:"name" firestore:"name"`
	Quantity string `json:"quantity" firestore:"quantity"`
	Unit     string `json:"unit,omitempty" firestore:"unit,omitempty"`
	Notes    string `json:"notes,omitempty" firestore:"notes,omitempty"`
}

type Recipe struct {
	ID            string       `json:"id" firestore:"id"`
	Name          string       `json:"name" firestore:"name"`
	Ingredients   []Ingredient `json:"ingredients" firestore:"ingredients"`
	Steps         []string     `json:"steps" firestore:"steps"`
	CookingTime   string       `json:"cooking_time" firestore:"cooking_time"`
	Cuisine       string       `json:"cuisine,omitempty" firestore:"cuisine,omitempty"`
	DietaryInfo   string       `json:"dietary_info,omitempty" firestore:"dietary_info,omitempty"`
	ImageURL      string       `json:"image_url,omitempty" firestore:"image_url,omitempty"`
	CreatedAt     time.Time    `json:"created_at" firestore:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at" firestore:"updated_at"`
	GeneratedByAI bool         `json:"generated_by_ai" firestore:"generated_by_ai"`
}
