
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the page via HTTP server
        page.goto('http://localhost:8000')

        # Wait for the music list to be populated
        try:
            page.wait_for_selector('.music-player', timeout=5000)

            # Take screenshot of the playlist section
            playlist_section = page.locator('.playlist-layout')
            playlist_section.scroll_into_view_if_needed()

            # Screenshot the whole playlist layout
            playlist_section.screenshot(path='verification/playlist.png')

            # Also log how many players were created
            count = page.locator('.music-player').count()
            print(f'Created {count} music players')

            # Check the Featured Track Iframe src
            iframe = page.locator('.spotify-embed iframe')
            src = iframe.get_attribute('src')
            print(f'Featured iframe src: {src}')

        except Exception as e:
            print(f'Error: {e}')
            page.screenshot(path='verification/error.png')

        browser.close()

if __name__ == '__main__':
    run()
