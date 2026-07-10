# **LeetCode Buddy**

**Your AI coding companion helping solve questions.**  
Stuck on a problem? This extension helps you by giving hints to the problem that get smarter each level.


---


## **✨ Features**

- 🧠 **Context-Aware Hints**
    - Analyzes your current code instead of giving generic advice.
- ⏱️ **Automatic Hint Timer**
    - Receive hints automatically after being stuck for a configurable amount of time.
- 📈 **Progressive Hint System**
    - Hints become more detailed only if your code hasn’t changed.
    - Never jumps straight to the solution.
- 🚫 **No Spoilers**
    - Prevents complete solutions or copy-paste code.
    - Encourages learning through guided thinking.
- 🌐 **Supports Multiple Languages**
    - Works with C++, Java, Python, JavaScript, and more.
- ⚙️ **Customizable**
    - Configure:
        - AI model
        - Hint timer
        - Groq API Key

---


## **🛠️ Tech Stack**

|**Technology**|**Purpose**|
|---|---|
|JavaScript|Extension Logic|
|Chrome Extension (Manifest V3)|Browser Integration|
|Chrome Storage API|Persist Settings & Progress|
|Chrome Alarms API|Timed Hint Generation|
|Groq API|AI Hint Generation|
|Qwen 3 (default)|Large Language Model|


---



## **⚡ How It Works**

```text
Open LeetCode
      │
      ▼
Detect Problem
      │
      ▼
Start Timer
      │
      ▼
Still Stuck?
      │
      ▼
Capture Current Code
      │
      ▼
Generate AI Hint
      │
      ▼
Display Hint
      │
      ▼
User Edits Code?
      │
 ┌────┴────┐
 │         │
Yes        No
 │         │
 ▼         ▼
Reset    Increase
Level    Hint Level
```

---


## **🧩 Hint Levels**

### **🟢 Level 1**

A gentle nudge pointing toward the next logical step.

---

### **🟡 Level 2**

Mentions the relevant concept or algorithmic pattern without revealing the solution.

---

### **🟠 Level 3**

Provides a stronger hint by suggesting the appropriate technique or data structure.

---

### 

### **🔴 Level 4**

**(Optional)**

A tiny pseudocode outline for users who remain stuck—still without providing the full implementation.


---


## **📸 Preview**

Add screenshots or GIFs here.

```text
assets/
├── popup.png
├── hint.png
└── demo.gif
```


---


## **🚀 Installation**

### **1. Clone the repository**

```bash
git clone https://github.com/yourusername/leetcode-buddy.git
```

### 

### **2. Load the extension**

1. Open **FireFox**
2. Navigate to:

```
about:debugging
```

3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the project folder


---


## **🔑 Configure API Key**

1. Click the extension icon
2. Paste your **Groq API Key**
3. Choose your AI Model (only one for now)
4. Set the desired hint interval


---


## **🎯 Future Improvements**

- Support for multiple coding platforms
- Difficulty-based hint customization
- Hint history
- Voice hints
- Theme customization
- AI chat mode
- Local LLM support
- Usage analytics


---


## **🤝 Contributing**

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Add a new feature"
```

4. Push the branch

```bash
git push origin feature/new-feature
```

5. Open a Pull Request 🚀


---


```html
<div align="center">
```

###

This project is forked from my friend's repo. This aims to add functionality over to the Firefox side.

### **⭐ Consider giving it a star to help boost project's reach!**

```html
</div>
```
