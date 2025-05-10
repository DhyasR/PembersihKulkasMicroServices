package firebase

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go"
	"google.golang.org/api/option"
)

var (
	FirestoreClient *firestore.Client
)

func InitFirebase(ctx context.Context) error {
	opt := option.WithCredentialsFile("firebase-adminsdk.json")

	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return err
	}

	FirestoreClient, err = app.Firestore(ctx)
	if err != nil {
		return err
	}

	log.Println("Firebase Firestore initialized successfully")
	return nil
}
