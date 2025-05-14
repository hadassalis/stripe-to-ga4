import json
import requests
from flask import Flask, request

app = Flask(__name__)

MEASUREMENT_ID = "G-DYX8LQJZFY"
API_SECRET = "thS3ewEXSw6k1Ed0ZXVmsw"

@app.route("/stripe-to-ga4", methods=["POST"])
def stripe_to_ga4():
    payload = request.get_json()

    if payload.get("type") != "checkout.session.completed":
        return {"status": "ignored"}, 200

    session = payload.get("data", {}).get("object", {})
    client_id = session.get("client_reference_id") or "555.555"  # fallback
    email = session.get("customer_details", {}).get("email", "na@example.com")
    phone = session.get("customer_details", {}).get("phone", "na")
    value = int(session.get("amount_total", 0)) / 100

    event_data = {
        "client_id": client_id,
        "events": [{
            "name": "purchase",
            "params": {
                "currency": "GBP",
                "value": value,
                "transaction_id": session.get("id"),
                "user_email": email,
                "user_phone": phone
            }
        }]
    }

    response = requests.post(
        f"https://www.google-analytics.com/mp/collect?measurement_id={MEASUREMENT_ID}&api_secret={API_SECRET}",
        json=event_data
    )

    return {"status": "sent", "ga4_response": response.status_code}, 200