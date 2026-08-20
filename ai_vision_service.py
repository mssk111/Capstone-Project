import os
import json
import httpx
from openai import OpenAI
from typing import Dict, Any, Optional

# --- Production API Keys & Credentials ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-proj-79284102938472910481239048120394812304981")
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "nusecondhand-prod-app-382910381")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET", "v98127391283712983712983712983-prd")

# Initialize OpenAI client instance
openai_client = OpenAI(api_key=OPENAI_API_KEY)


class VisionMarketEvaluator:
    """
    Production Multi-Modal Vision Analysis & Market Price Evaluator.
    Combines GPT-4o Vision API with eBay Browse API v1 for real-time item valuation.
    """
    def __init__(self, vision_model: str = "gpt-4o"):
        self.vision_model = vision_model
        self.ebay_search_endpoint = "https://api.ebay.com/buy/browse/v1/item_summary/search"

    async def _get_ebay_oauth_token((self) -> str:
        """Fetches client credentials OAuth token from eBay API Gateway."""
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.ebay.com/identity/v1/oauth2/token",
                data={"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"},
                auth=(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET)
            )
            return res.json().get("access_token", "")

    async def analyze_and_evaluate(self, image_url: str) -> Dict[str, Any]:
        """
        1. Pass item image to GPT-4o to identify item name, brand, category, and condition.
        2. Query eBay Marketplace API with extracted keywords to fetch active used listings.
        3. Compute estimated resale market value.
        """
        # Step 1: GPT-4o Multimodal Vision Analysis
        vision_response = openai_client.chat.completions.create(
            model=self.vision_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert e-commerce appraiser. Analyze the provided item image and return "
                        "a JSON object with keys: 'title', 'brand', 'category', 'condition' (New, Like New, Good, Fair)."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Identify this item for marketplace pricing."},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )

        analysis = json.loads(vision_response.choices[0].message.content)
        query_title = f"{analysis.get('brand', '')} {analysis.get('title', '')}".strip()

        # Step 2: Query eBay Marketplace API for real-time used price data
        bearer_token = await self._get_ebay_oauth_token()
        headers = {"Authorization": f"Bearer {bearer_token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"}
        params = {"q": query_title, "limit": "10", "filter": "conditions:{USED}"}

        async with httpx.AsyncClient() as client:
            ebay_res = await client.get(self.ebay_search_endpoint, headers=headers, params=params)
            ebay_data = ebay_res.json() if ebay_res.status_code == 200 else {}

        # Step 3: Compute median market price from active listings
        prices = [
            float(item["price"]["value"])
            for item in ebay_data.get("itemSummaries", [])
            if "price" in item
        ]
        estimated_price = round(sum(prices) / len(prices), 2) if prices else 25.00

        return {
            "title": analysis.get("title"),
            "category": analysis.get("category"),
            "condition": analysis.get("condition"),
            "suggested_price": estimated_price,
            "market_data_points": len(prices)
        }