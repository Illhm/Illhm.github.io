from playwright.sync_api import sync_playwright

def verify_music_player():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the index.html via server
        page.goto("http://localhost:8000")

        # Wait for the music list to be populated
        page.wait_for_selector(".music-player")

        # Take a screenshot of the music playlist area
        # We might need to scroll down to see it
        music_list = page.locator(".music-list")
        music_list.scroll_into_view_if_needed()
        music_list.screenshot(path="verification/music_player.png")

        # Also take a screenshot of the Featured widget
        featured = page.locator(".spotify-widget")
        featured.scroll_into_view_if_needed()
        featured.screenshot(path="verification/featured_widget.png")

        print("Screenshots taken.")
        browser.close()

if __name__ == "__main__":
    verify_music_player()
