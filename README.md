## 🍽️ Menu Search Platform

**Findish – AI-powered Recipe Search from YouTube**

Findish is an ingredient-based recipe search platform powered by Perplexity’s Sonar API.  
It helps users discover dishes using the ingredients they already have by automatically extracting recipes from YouTube content—such as pinned comments, descriptions, and transcripts.

## 💡 Why I Built This

I’ve always loved cooking and wanted to be a chef back in the day.  
So, I still watch cooking videos, learn new recipes, and try them out myself.  
However, I often ran into a common problem: having leftover ingredients and no idea what to make with them.

I've seen a lot of people facing the same problem as I do.

So I thought:  
**What if I could build a website that helps people search for recipes based on the ingredients they already have with AI?**

That’s how **Findish** was born:  
An ingredient-first, bilingual (Korean-English) recipe search tool that helps people discover relevant YouTube cooking videos using what’s already in their fridge.  
By combining unstructured YouTube content with **Perplexity’s Sonar API**, the tool transforms scattered text into structured recipe data—making cooking easier, smarter, and more fun.


## 📹 Demo Video

[[YouTube Link Here](https://www.youtube.com/watch?v=jdgU2PMsR2k&t=7s)]

## 🧠 How It Works

1. **YouTube Video Scraping**  
   - We collect metadata, pinned comments, description boxes, and transcripts from Korean and English YouTube cooking videos.

2. **Prompt Engineering + Sonar API**  
   - We send that unstructured text to **Perplexity's Sonar API**, prompting it to extract the:
     - Dish name
     - List of ingredients
     - Source location (pinned/description/transcript)
     - Language

3. **Ingredient Normalization & Storage**  
   - Parsed data is stored in structured JSON/JS files (`menuData_kr.js`, `menuData_en.js`), normalized to group similar ingredients (e.g., "chili powder", "gochugaru").

4. **Frontend Recipe Search**  
   - Users can select ingredients using a smart tag-based search bar (React Select).
   - Matching recipes are instantly displayed with dish name, uploader, tips, and video links.

## ✨ Features

- 🔍 **Multi-ingredient search** with dropdown
- 🌐 **Korean / English support**
- 💡 **Modern UI/UX** with dark/light mode
- ⚙️ Powered by **Perplexity Sonar API**
- 📁 Uses **pre-parsed YouTube data** for speed
- 👨‍🍳 Shows **source** of parsed data (comment/desc/transcript)

## 📦 Tech Stack

- **Frontend:** React, Tailwind CSS, React-Select
- **Backend Script:** Python, YouTube Data API, Perplexity Sonar API
- **Deployment:** Vercel (in progress)

## 🧪 Perplexity API Integration

We used **Sonar API** to extract structured recipe data from unstructured YouTube text.  
Prompts were crafted to be robust across different video formats and languages.  
We also implemented logic to:
- Detect language (KR/EN)
- Prioritize pinned comments > descriptions > transcripts
- Reject non-recipe promotional content

Example prompt:
> This is a pinned comment from a Korean cooking YouTube video. Extract the name of the recipe and list the ingredients. If it's not a recipe, respond with "Only product advertisement or promotion."


## 🔧 Setup Instructions

1. Clone the repository and move into the project directory:  
   `git clone [repo-url] && cd [project-folder]`

2. Install frontend dependencies:  
   `npm install`

3. Create a `.env` file and a `logs` folder in the root directory.

4. Install required Python packages:  
   `pip install requests python-dotenv google-api-python-client youtube-transcript-api langdetect`

5. Get the Channel ID of the YouTuber you want to fetch data from.

6. Run the automation script to fetch and parse YouTube data:  
   `python youtube_automation.py`

7. Start the frontend development server:  
   `npm start`
