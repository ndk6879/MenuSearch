## 🍽️ Menu Search Platform

Interactive platform for discovering recipes using ingredients you already have at home.  
This is an updated version of the original [Menu-Search-Project](https://github.com/ndk6879/Menu-Search-Project).  
The MVP (Minimum Viable Product) will be released soon.
<br>


🛠️ **Tech Stack:** React.js, Node.js, Elasticsearch, MongoDB, Tailwind CSS, Express.js  
<br>

💡 **Why React from Python?**

The initial prototype was built using Python and Django, but we transitioned to React to enhance interactivity and user experience.
React enables modular UI components, efficient re-rendering, and better control over frontend behavior—making the platform more dynamic and responsive.  
<br>

🔍 **Why Elasticsearch?**

Elasticsearch was chosen to provide powerful and flexible search features tailored for recipe discovery:

1. Fuzzy Search – Typo-tolerant matching.

    👉 Example: Searching for "chikcen fried rice" still returns "chicken fried rice".

2. Autocomplete – Real-time search suggestions, similar to YouTube or Google.

3. Weighted Search – Recipes are ranked based on how many input ingredients match the recipe’s list.
<br>

🗃️ **Why MongoDB?**

MongoDB’s flexible document structure makes it ideal for storing various recipe data, including ingredients, tips, and external links.  
It also works seamlessly with Elasticsearch, allowing for efficient indexing and search capabilities.  
Additionally, MongoDB integrates naturally with Node.js, streamlining development and improving data-handling performance.
