# Privacy Policy — Balade

*Last updated: November 19, 2026*

## What Balade does

Balade is a Chrome extension that places animated cursors on any web page. The cursors move, inspect elements, type ghost text into empty fields, and react to what you do — without sending any event to the page or reading sensitive content.

## Data collected

### Click sequences (habit learning)

When the "Learn my habits" toggle is on, Balade records sequences of elements you click on a given site. Only the structural identity of each element is stored (tag name, non-sensitive attributes such as `id`, `class`, `href`, `type`). **What you type is never read or stored.**

This data is saved in `chrome.storage.local`, on your device only. It is never transmitted to any server, never shared with any third party.

You can review and delete what has been learned for any site from the Balade menu ("This site" section → "Forget").

### User preferences

Your settings (theme, cursor count, volume, behavior toggles) are saved in `chrome.storage.sync` so they stay consistent across your devices via your Chrome account. No preference data is shared with Balade's developers or any third party.

### Video recording

When you explicitly click "Record a video of the tab", the tab's audio and video stream is captured, encoded as a WebM file entirely on your device, and downloaded to your computer when you stop. No recording is uploaded or transmitted anywhere.

## Data NOT collected

Balade does not collect, read, or transmit:

- Passwords or authentication credentials
- Form content or anything you type
- Browsing history
- Personal information (name, email, location, IP address)
- Financial information
- Health information
- Communications

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `activeTab` | Inject cursors into the tab you are viewing, only when you trigger Balade |
| `scripting` | Inject the cursor script files into the active tab |
| `storage` | Save your preferences and learned click sequences locally |
| `tabCapture` | Capture the tab stream when you explicitly start a recording |
| `offscreen` | Run the video encoder in a background context (required by Chrome MV3) |
| `downloads` | Save the recorded WebM file to your computer |
| `optional_host_permissions` | Allow auto-start on sites you explicitly opt in to; requested per site, never in bulk |

## Third parties

Balade does not share any data with third parties. No analytics, no advertising, no telemetry.

## Changes to this policy

If this policy changes in a meaningful way, the updated date at the top of this page will reflect it. The extension will not silently collect new categories of data.

## Contact

If you have questions about privacy, open an issue on the [GitHub repository](https://github.com/fox3000foxy/balade).
