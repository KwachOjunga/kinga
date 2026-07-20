#!/usr/bin/env python3
"""Train anticipation model — hackathon build uses statistical baseline in anticipation.py."""

from __future__ import annotations

from model.generate_synthetic_data import save_time_series

if __name__ == "__main__":
    path = save_time_series()
    print(f"Anticipation model uses statistical baseline on data at {path}")
    print("Run: uvicorn main:app --reload")
