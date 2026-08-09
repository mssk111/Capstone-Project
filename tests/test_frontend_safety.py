import re
from pathlib import Path


SCRIPT = (Path(__file__).parents[1] / "script.js").read_text(encoding="utf-8")


def test_local_user_records_do_not_store_passwords():
    assert not re.search(r"users\.push\(\{[^}]*\bpassword\b", SCRIPT)
    assert "password: user.password" not in SCRIPT


def test_browser_does_not_administer_storage_buckets():
    assert ".createBucket(" not in SCRIPT
    assert ".getBucket(" not in SCRIPT


def test_listing_write_failures_have_user_messages():
    assert "Unable to publish listing. Please try again." in SCRIPT
    assert "Unable to update listing. Please try again." in SCRIPT
    assert "Unable to delete listing. Please try again." in SCRIPT
    assert "The listing was not saved" in SCRIPT
    assert "The listing was not updated" in SCRIPT
    assert "The listing was not deleted" in SCRIPT


def test_listing_insert_requires_session_and_confirms_rows():
    assert "Your session has expired. Please log in again." in SCRIPT
    assert ').select("local_item_id")' in SCRIPT
    assert "data.length !== items.length" in SCRIPT


def test_photo_storage_failure_does_not_block_listing_publish():
    assert "compressListingImageForDatabase" in SCRIPT
    assert "saving compressed images with the listing" in SCRIPT
    assert 'canvas.toDataURL("image/webp", quality)' in SCRIPT
    assert "The listing was published, but the uploaded photo could not be stored" not in SCRIPT
    assert "Publishing ${listings.length}..." in SCRIPT
