package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	JwtSecret    string `json:"jwtSecret"`
	ClientOrigin string `json:"clientOrigin"`
	SqliteFile   string `json:"sqlite_file"`
}

func loadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}

	var cfg Config
	err = json.Unmarshal(data, &cfg)
	if err != nil {
		return Config{}, err
	}

	err = cfg.Validate()
	if err != nil {
		return Config{}, err
	}
	
	return cfg, nil
}

func (c *Config) Validate() error {
	if c.JwtSecret == "" {
		return fmt.Errorf("jwtSecret is required")
	}
	if c.ClientOrigin == "" {
		return fmt.Errorf("clientOrigin is required")
	}
	if c.SqliteFile == "" {
		return fmt.Errorf("sqlite_file is required")
	}
	return nil
}