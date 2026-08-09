from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def test_health_returns_service_status():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "nu-secondhand-api"}


def test_report_requires_a_listing_or_user_target():
    response = client.post(
        "/api/reports",
        json={
            "reporter_id": "00000000-0000-0000-0000-000000000001",
            "reason": "spam",
            "details": "Test report without a target",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "A listing or user must be reported"


def test_admin_endpoint_rejects_missing_token():
    response = client.get("/api/admin/reports")

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role required"
