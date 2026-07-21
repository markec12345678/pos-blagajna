// Package main is the entrypoint for the nutrix application.
//
// VARNOSTNI POPRAVEK #03:
// Ob zagonu preveri, da JWT skrivnost ni privzeta (placeholder)
// vrednost iz config.example.yaml. Če je, aplikacija panics.
// Prav tako preveri, da skrivnost ustreza minimalni dolžini (32 bytov).
package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/nutrixpos/pos/cmd"
	"github.com/nutrixpos/pos/common/config"
	"github.com/nutrixpos/pos/common/logger"
	"github.com/nutrixpos/pos/common/userio"
)

// Seznam znanih slabih (placeholder) JWT skrivnosti, ki so prisotne v
// vzorčni konfiguraciji in GitHub repo. Če je katera od njih v uporabi,
// aplikacija zavrne zagon.
var knownInsecureSecrets = map[string]string{
	"your-super-secret-jwt-key-change-in-production": "default from config.example.yaml",
	"secret":           "too short / common",
	"jwt_secret":       "placeholder",
	"changeme":         "placeholder",
	"change-me":        "placeholder",
	"your-secret-key":  "placeholder",
}

func main() {

	// Initialize the logger using ZeroLog
	logger := logger.NewZeroLog()

	// Create the configuration using the Viper config backend
	conf := config.ConfigFactory("viper", "config.yaml", &logger)

	// VARNOSTNI POPRAVEK #03: Validiraj JWT skrivnost pred zagonom.
	if conf.Auth.Enabled {
		validateJWTSecret(&logger, conf.Auth.JWTSecret)
	}

	// Initialize the prompter for user interaction
	prompter := &userio.BubbleTeaSeedablesPrompter{
		Logger: &logger,
	}
	// Initialize the root command process with configuration and modules
	rootCmd := cmd.RootProcess{
		Config:   conf,
		Logger:   &logger,
		Prompter: prompter,
	}

	// Execute the root command to start the application
	rootCmd.Execute()
}

// validateJWTSecret preveri, da JWT skrivnost ni placeholder in je dovolj dolga.
// Če ni, aplikacija konča z napako.
func validateJWTSecret(logger logger.ILogger, secret string) {
	if secret == "" {
		logger.Error("JWT skrivnost je prazna — generiraj novo z:")
		logger.Error("  openssl rand -base64 48")
		logger.Error("in jo vstavi v config.yaml pod auth.jwt_secret")
		os.Exit(1)
	}

	// Preveri, ali je skrivnost na seznamu znanih slabih vrednosti.
	if description, ok := knownInsecureSecrets[secret]; ok {
		logger.Error(fmt.Sprintf("Zaznana nesigurna JWT skrivnost (%s)", description))
		logger.Error("Generiraj novo skrivnost z:")
		logger.Error("  openssl rand -base64 48")
		logger.Error("in jo vstavi v config.yaml pod auth.jwt_secret")
		os.Exit(1)
	}

	// Preveri minimalno dolžino (32 bytov = 256 bitov za HS256).
	if len(secret) < 32 {
		logger.Error(fmt.Sprintf("JWT skrivnost je prekratka (%d bytov, potrebno najmanj 32)", len(secret)))
		logger.Error("Generiraj novo skrivnost z:")
		logger.Error("  openssl rand -base64 48")
		os.Exit(1)
	}

	// V dev načinu opozori, če skrivnost izgleda kot base64 generirana
	// vendar je v dev okolju — v redu je, vendar naj bo opozorilo.
	logger.Info("JWT skrivnost validirana ✓")
}

// generateSecureToken je pomožna funkcija, ki jo lahko kličeš iz CLI
// za generiranje novega žetona. Zaenkrat ni izpostavljena kot ukaz,
// vendar je tu za dokumentacijo.
//
// Uporaba:
//   token := generateSecureToken(32)
//   fmt.Println(token) // 64 hex znakov
//
// ali preko CLI:
//   go run ./cmd/pos generate-token
func generateSecureToken(byteLen int) string {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand failed: %v", err))
	}
	return hex.EncodeToString(b)
}
