import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeVideoClip = async (
  file: File,
  apiKey: string
): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert File to Base64
  const base64Data = await fileToGenerativePart(file);

  const prompt = `
    Analyze this NFL video clip.
    I need you to reconstruct the player and ball positions on a 2D coordinate system to create a tactical replay.
    
    The Coordinate System:
    - X-axis: 0 to 120 yards. (0-10 is left endzone, 10-110 is the playing field, 110-120 is right endzone).
    - Y-axis: 0 to 53.3 yards (Standard NFL width).
    
    Task:
    1. Identify the formation and play summary.
    2. Sample the video at key moments (approx every 0.5 to 1 second) to capture the flow.
    3. For each sampled moment (keyframe), estimate the (x, y) coordinates of:
       - The Ball.
       - Key players from Team Red (Attacking/Offense usually).
       - Key players from Team Blue (Defending/Defense usually).
       - If you cannot see all 22 players, just track the visible ones or the most relevant ones involved in the play.
    4. Return a strictly structured JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        systemInstruction: "You are an expert NFL tactical analyst and computer vision system.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            formation: { type: Type.STRING },
            playType: { type: Type.STRING },
            keyframes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeOffset: { type: Type.NUMBER, description: "Time in seconds from start of clip" },
                  ball: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                    },
                    required: ["x", "y"]
                  },
                  teamRed: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING, description: "Player number or position ID like QB, WR1" },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                      },
                      required: ["x", "y"]
                    },
                  },
                  teamBlue: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING, description: "Player number or position ID like LB, CB" },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                      },
                      required: ["x", "y"]
                    },
                  },
                },
                required: ["timeOffset", "ball", "teamRed", "teamBlue"]
              },
            },
          },
          required: ["summary", "formation", "playType", "keyframes"],
        },
      },
    });

    if (!response.text) {
        throw new Error("No response from Gemini");
    }

    const data = JSON.parse(response.text) as AnalysisResult;
    
    // Sanity check and sort frames by time
    data.keyframes.sort((a, b) => a.timeOffset - b.timeOffset);
    
    return data;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:video/mp4;base64,")
      const base64Chunk = result.split(",")[1];
      resolve(base64Chunk);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
