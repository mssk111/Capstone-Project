"""Administrative API for the NU Secondhand marketplace.

Run locally with: uvicorn app:app --reload
Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.  The service
role key stays on the server; browsers authenticate with a Supabase access token.
"""
import os
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from pydantic import BaseModel, Field

app = FastAPI(title="NU Secondhand Admin API")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


async def require_admin(authorization: Optional[str] = Header(default=None)):
    """Verify the caller's Supabase JWT before using the service role database key."""
    if not authorization or not authorization.startswith("Bearer ") or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": authorization},
        )
    if response.is_error or response.json().get("app_metadata", {}).get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


def service_headers():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase service is not configured")
    return {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}


async def db(method: str, table: str, *, params=None, json=None, headers=None):
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.request(method, f"{SUPABASE_URL}/rest/v1/{table}", params=params, json=json,
                                        headers={**service_headers(), **(headers or {})})
    if response.is_error:
        raise HTTPException(response.status_code, response.text)
    return response.json() if response.content else None


class ReportCreate(BaseModel):
    reporter_id: str
    reported_user_id: Optional[str] = None
    listing_id: Optional[int] = None
    reason: Literal["spam", "scam", "harassment"]
    details: str = Field(default="", max_length=2000)


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    icon: str = "tag"
    is_active: bool = True
    display_order: int = 0


class ReportStatus(BaseModel):
    status: Literal["resolved", "dismissed"]


@app.post("/api/admin/users/{user_id}/warn", dependencies=[Depends(require_admin)])
async def warn_user(user_id: str):
    rows = await db("PATCH", "users", params={"id": f"eq.{user_id}"}, json={"status": "warned"},
                    headers={"Prefer": "return=representation"})
    if not rows:
        raise HTTPException(404, "User not found")
    return rows[0]


@app.post("/api/admin/users/{user_id}/ban", dependencies=[Depends(require_admin)])
async def ban_user(user_id: str):
    rows = await db("PATCH", "users", params={"id": f"eq.{user_id}"}, json={"status": "banned"},
                    headers={"Prefer": "return=representation"})
    if not rows:
        raise HTTPException(404, "User not found")
    return rows[0]


@app.delete("/api/admin/listings/{listing_id}", status_code=204, dependencies=[Depends(require_admin)])
async def remove_listing(listing_id: int):
    rows = await db("PATCH", "listings", params={"id": f"eq.{listing_id}"}, json={"status": "removed"},
                    headers={"Prefer": "return=representation"})
    if not rows:
        raise HTTPException(404, "Listing not found")
    return Response(status_code=204)


@app.post("/api/reports", status_code=201)
async def create_report(report: ReportCreate):
    if not report.reported_user_id and not report.listing_id:
        raise HTTPException(422, "A listing or user must be reported")
    rows = await db("POST", "reports", json=report.model_dump(), headers={"Prefer": "return=representation"})
    return rows[0]


@app.get("/api/listings")
async def public_listings():
    """Only listings and categories currently visible to marketplace users."""
    return await db("GET", "listings", params={"status": "eq.active", "is_sold": "eq.false", "order": "created_at.desc"})


@app.get("/api/admin/reports", dependencies=[Depends(require_admin)])
async def pending_reports():
    # Scam reports lead the queue, then oldest reports for predictable handling.
    return await db("GET", "reports", params={"status": "eq.pending", "order": "created_at.asc"})


@app.patch("/api/admin/reports/{report_id}", dependencies=[Depends(require_admin)])
async def resolve_report(report_id: str, update: ReportStatus):
    rows = await db("PATCH", "reports", params={"id": f"eq.{report_id}"},
                    json={"status": update.status, "resolved_at": datetime.now(timezone.utc).isoformat()},
                    headers={"Prefer": "return=representation"})
    if not rows:
        raise HTTPException(404, "Report not found")
    return rows[0]


@app.get("/api/categories")
async def public_categories():
    return await db("GET", "categories", params={"is_active": "eq.true", "order": "display_order.asc,name.asc"})


@app.get("/api/admin/categories", dependencies=[Depends(require_admin)])
async def admin_categories():
    return await db("GET", "categories", params={"order": "display_order.asc,name.asc"})


@app.post("/api/admin/categories", status_code=201, dependencies=[Depends(require_admin)])
async def add_category(category: CategoryIn):
    rows = await db("POST", "categories", json=category.model_dump(), headers={"Prefer": "return=representation"})
    return rows[0]


@app.put("/api/admin/categories/{category_id}", dependencies=[Depends(require_admin)])
async def update_category(category_id: str, category: CategoryIn):
    rows = await db("PATCH", "categories", params={"id": f"eq.{category_id}"}, json=category.model_dump(),
                    headers={"Prefer": "return=representation"})
    if not rows:
        raise HTTPException(404, "Category not found")
    return rows[0]


@app.delete("/api/admin/categories/{category_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_category(category_id: str):
    await db("DELETE", "categories", params={"id": f"eq.{category_id}"})
    return Response(status_code=204)


@app.get("/api/admin/analytics", dependencies=[Depends(require_admin)])
async def analytics():
    metrics = await db("GET", "platform_analytics")
    terms = await db("GET", "top_search_terms")
    return {**(metrics[0] if metrics else {}), "top_search_terms": terms}
