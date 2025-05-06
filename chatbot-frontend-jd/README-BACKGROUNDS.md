# Chat Background Images

This document explains how to change the background image used in the chat interface.

## How to Change the Background Image

1. **Add your image file:**
   - Place your desired background image in the `/public/images/` directory
   - Recommended image formats: JPG, PNG, or WebP
   - Recommended dimensions: At least 1920x1080px for best quality on larger displays
   - Consider using images that won't make text difficult to read

2. **Update the configuration:**
   - Open the file: `src/config/chatConfig.js`
   - Change the `CHAT_BACKGROUND` value to point to your new image:
   ```js
   export const CHAT_BACKGROUND = "/images/your-new-image.jpg";
   ```

3. **Restart the development server** (if it's running) for the changes to take effect

## Tips for Selecting Background Images

- **Consider contrast:** Choose images that won't interfere with message readability
- **File size:** Compress images to minimize load times (aim for under 500KB)
- **Theme consistency:** Select images that match your app's color scheme and theme
- **Not too busy:** Simple patterns or gradient backgrounds usually work best

## Default Background

The default background can be found at `/public/images/test-image.jpg`.

## Adding Multiple Background Options

If you want to allow multiple background options or theme choices, you can modify the `chatConfig.js` file to include an array of backgrounds and add UI controls to switch between them.

Example config modification:
```js
export const CHAT_BACKGROUNDS = [
  { id: "default", path: "/images/test-image.jpg", name: "Default" },
  { id: "nature", path: "/images/nature.jpg", name: "Nature" },
  { id: "abstract", path: "/images/abstract.jpg", name: "Abstract" }
];

// Default background to use
export const DEFAULT_BACKGROUND_ID = "default";
```

Then you would need to modify the ChatbotLayout component to allow selection between these options. 