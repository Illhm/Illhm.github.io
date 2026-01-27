from playwright.sync_api import sync_playwright

def verify_index(page):
    page.goto("http://localhost:8080/index.html")

    # Wait for the spotify widget to be visible
    page.wait_for_selector(".spotify-widget")

    # Scroll to the playlist section
    playlist_section = page.locator("section").filter(has_text="Playlist")
    playlist_section.scroll_into_view_if_needed()

    # Take a screenshot of the spotify widget area
    page.locator(".spotify-widget").screenshot(path="verification/spotify_widget.png")

    # Also verify that the removed text is not present
    content = page.content()
    assert "Favorit terbaru minggu ini" not in content
    assert "Auto update dari SpotDL" not in content
    print("Verification text assertions passed.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_index(page)
        finally:
            browser.close()
