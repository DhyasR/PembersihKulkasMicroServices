// config/config.go
package config

import (
	"os"
)

type Config struct {
	OpenAIKey      string
	FirebaseConfig string
}

func LoadConfig() *Config {
	return &Config{
		OpenAIKey:      os.Getenv("OPENAI_API_KEY"),
		FirebaseConfig: os.Getenv("FIREBASE_CONFIG"),
	}
}
