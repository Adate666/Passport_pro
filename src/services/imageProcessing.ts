import { removeBackground } from "@imgly/background-removal";

export class ImageProcessor {
    /**
     * Removes the background from an image using a local WASM model.
     * @param imageSource URL, Blob, or File
     * @returns Blob URL of the image with transparent background
     */
    static async removeBackground(imageSource: string | Blob | File): Promise<string> {
        try {
            // Configuration for @imgly/background-removal
            // It fetches assets from a CDN by default, which avoids complex Vite config.
            const blob = await removeBackground(imageSource, {
                progress: (key, current, total) => {
                    console.log(`Downloading ${key}: ${current} of ${total}`);
                }
            });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error("Background removal failed:", error);
            throw error;
        }
    }

    static async autoCrop(imageSrc: string): Promise<string> {
        // Basic center crop implementation (placeholder for detection-based crop)
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Standard aspect ratio for passport (35x45 -> 0.77)
                const aspect = 35 / 45;

                let cropWidth = img.width;
                let cropHeight = img.width / aspect;

                if (cropHeight > img.height) {
                    cropHeight = img.height;
                    cropWidth = img.height * aspect;
                }

                // Assume face is centered (default heuristic)
                const x = (img.width - cropWidth) / 2;
                const y = (img.height - cropHeight) / 2;

                canvas.width = cropWidth;
                canvas.height = cropHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject("Canvas context failed");
                    return;
                }

                ctx.drawImage(img, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = imageSrc;
        });
    }
}
