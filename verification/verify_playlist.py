
from playwright.sync_api import sync_playwright
from pathlib import Path

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Determine absolute path to index.html
        html_path = Path('index.html').resolve()

        # Load the page
        page.goto(f'file://{html_path}')

        # Wait for the music list to be populated
        page.wait_for_selector('.music-player')

        # Take screenshot of the playlist section
        # We scroll to the playlist section first
        playlist_section = page.locator('.playlist-layout')
        playlist_section.scroll_into_view_if_needed()

        # Screenshot the whole playlist layout
        playlist_section.screenshot(path='verification/playlist.png')

        # Also log how many players were created
        count = page.locator('.music-player').count()
        print(f'Created {count} music players')

        browser.close()

if __name__ == '__main__':
    run()
