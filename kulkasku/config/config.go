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
		FirebaseConfig: os.Getenv("FIREBASE_CONFIG"),
	}
}
