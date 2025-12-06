
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { Framework, Feature, GeneratedProject } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly ai: GoogleGenAI;

  constructor() {
    // IMPORTANT: The API key is injected via environment variables.
    // Do not hardcode or expose it in the frontend.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY environment variable not set.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async callGenerativeModel(fullPrompt: string): Promise<GeneratedProject> {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              files: {
                type: Type.ARRAY,
                description: 'An array of objects, where each object represents a file with its path and content.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: {
                      type: Type.STRING,
                      description: 'The full path of the file (e.g., "Controllers/HomeController.cs").'
                    },
                    content: {
                      type: Type.STRING,
                      description: 'The code content of the file.'
                    }
                  },
                  required: ['path', 'content']
                }
              },
              dependencies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of NuGet package names required for the project.'
              },
              explanation: {
                type: Type.STRING,
                description: 'A brief explanation of the generated project structure and key files.'
              },
              build_commands: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of CLI commands to build and run the project.'
              }
            },
            required: ["files", "dependencies", "explanation", "build_commands"],
          },
        },
      });

      const jsonString = response.text.trim();
      const rawResponse: {
        files: { path: string; content: string }[];
        dependencies: string[];
        explanation: string;
        build_commands: string[];
      } = JSON.parse(jsonString);

      // Transform the files array into the dictionary format the app expects
      const filesDictionary = rawResponse.files.reduce((acc, file) => {
        if (file.path && file.content) {
          acc[file.path] = file.content;
        }
        return acc;
      }, {} as { [key: string]: string });

      const generatedProject: GeneratedProject = {
        ...rawResponse,
        files: filesDictionary,
      };
      
      // Basic validation
      if (Object.keys(generatedProject.files).length === 0) {
        throw new Error('AI response is missing valid file structure.');
      }

      return generatedProject;
  }

  async generateProject(prompt: string, framework: Framework, features: Feature[]): Promise<GeneratedProject> {
    const featureList = features.map(f => f.label).join(', ');
    const fullPrompt = `
      You are an expert .NET architect specializing in ASP.NET Core. Your task is to generate a complete, production-ready ASP.NET Core project based on the user's requirements.

      **Project Requirements:**
      - **User Prompt:** "${prompt}"
      - **Framework:** "${framework.label}"
      - **Selected Features:** ${featureList.length > 0 ? featureList : 'None'}

      **Instructions:**
      1.  **Generate a file structure:** Create a complete set of files for the project. This includes .csproj, Program.cs, Startup.cs (if applicable), appsettings.json, controllers, models, views/pages, services, etc.
      2.  **Implement the logic:** Write the code for each file to fulfill the user's prompt and selected features.
      3.  **Include Dependencies:** List all necessary NuGet packages.
      4.  **Provide Build Commands:** List the CLI commands to build and run the project (e.g., 'dotnet restore', 'dotnet build', 'dotnet run').
      5.  **Write an Explanation:** Briefly explain the project structure and how to get started.
      6.  **Format:** Return the entire output as a single, valid JSON object matching the provided schema. Do not include any markdown formatting like \`\`\`json.
    `;

    try {
      return await this.callGenerativeModel(fullPrompt);
    } catch (error) {
      console.error("Error calling Gemini API for generation:", error);
      throw new Error("Failed to generate project. The AI model may be overloaded or the request was invalid. Please check your prompt and try again.");
    }
  }

  async modifyProject(prompt: string, existingProject: GeneratedProject): Promise<GeneratedProject> {
    const fullPrompt = `
      You are an expert AI .NET developer. You will be given an existing .NET project as a JSON object and a user request for modification.
      Your task is to apply the requested changes and return the *entire*, updated project structure in the exact same JSON format.
      Do not just return the changed files; return all files, whether modified or not. Your response must be the complete project.

      **User Request for Modification:**
      "${prompt}"

      **Existing Project JSON:**
      ${JSON.stringify(existingProject)}

      Now, provide the complete and updated project as a single, valid JSON object matching the required schema. Do not add any commentary, explanations, or markdown formatting outside of the JSON structure itself. The 'explanation' field in the JSON should describe the changes you made.
    `;
    
    try {
        return await this.callGenerativeModel(fullPrompt);
    } catch (error) {
        console.error("Error calling Gemini API for modification:", error);
        throw new Error("Failed to modify project. The AI model may be overloaded or the request was invalid.");
    }
  }
}
