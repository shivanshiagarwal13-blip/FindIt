# FindIt — Campus Lost & Found — Viva & Project Guide

> **Quick Answer:** Yes! All changes made were saved directly to `app.js` on your computer. When you switch to VS Code, the updated code is already there.

---

## 1. Project Overview & Tech Stack

This project is a full-stack **Campus Lost & Found Matching System** that pairs lost items with found items using a rule-based matching score.

* **Backend:** Pure Java (JDK 17 or newer)
  * **Server:** Built-in `com.sun.net.httpserver.HttpServer` (No Spring Boot, no Tomcat, no Maven needed).
  * **Database:** **No SQL database** is used. Data is stored in memory using Java Collections (`ArrayList`, `HashMap`) and persisted locally to a binary file `data/lost-found.bin` using Java Object Serialization (`ObjectOutputStream` / `ObjectInputStream`).
* **Frontend:** Vanilla HTML5, CSS3, Modern JavaScript (ES6+)
  * **Architecture:** Single-Page Application (SPA) with responsive design and light/dark theme.
  * **Frameworks:** **Zero libraries** (No React, Vue, Angular, or npm packages required).
  * **Data Transfer:** Asynchronous `fetch()` API exchanging JSON with Java REST endpoints.

---

## 2. Frontend & Backend: How They Connect

```text
[ Browser / Frontend: app.js & lost-and-found.html ]
                     │
          HTTP GET / POST requests (JSON / Form Data)
                     ▼
[ Web Adapter: WebServer.java (HttpServer on port 8080) ]
                     │
          Method calls on Java objects
                     ▼
[ Core OOP Business Logic: LostAndFoundSystem.java ]
                     │
          Manages OOP Objects & Collections
                     ▼
[ Item.java | LostItem.java | FoundItem.java | Student.java ]
                     │
          Java Object Serialization
                     ▼
[ Local Disk: data/lost-found.bin ]
```

---

## 3. OOP (Object-Oriented Programming) Concepts

When the examiner asks: *"Where have you used OOP concepts?"*, open the corresponding file in VS Code and show them these exact examples:

### A. Inheritance (`extends`)
* **Concept:** Child classes inherit common fields and methods from a parent class, avoiding duplicate code.
* **Where to show in VS Code:**
  * Open **`LostItem.java`**:
    ```java
    public class LostItem extends Item { ... }
    ```
  * Open **`FoundItem.java`**:
    ```java
    public class FoundItem extends Item { ... }
    ```
  * Both inherit `name`, `category`, `location`, `description`, `reportedBy`, `timeFrom`, and `timeTo` from the base class **`Item.java`**.

---

### B. Abstraction (`abstract class`)
* **Concept:** Hiding low-level implementation and preventing direct creation of incomplete objects.
* **Where to show in VS Code:**
  * Open **`Item.java`**:
    ```java
    public abstract class Item implements java.io.Serializable {
        ...
        public abstract void displayItem();
    }
    ```
  * *Viva Explanation:* An `Item` cannot exist on its own in the real world—an item is always either *Lost* or *Found*. Marking `Item` as `abstract` enforces this rule.

---

### C. Polymorphism (Method Overriding `@Override`)
* **Concept:** Different classes implement the same method in their own unique way.
* **Where to show in VS Code:**
  * **`LostItem.java`**:
    ```java
    @Override
    public void displayItem() {
        System.out.println(name + " | " + category + " | " + location + " | Lost on " + dateLost + " | " + description);
    }
    ```
  * **`FoundItem.java`**:
    ```java
    @Override
    public void displayItem() {
        System.out.println("ID " + id + " | " + name + " | " + category + " | " + location
            + " | Found on " + dateFound + " | " + description + " | " + (claimed ? "Claimed" : "Available"));
    }
    ```
  * *Viva Explanation:* Both share the exact same method signature `displayItem()`, but `FoundItem` prints the unique Item ID and Claimed status, while `LostItem` prints the loss date.

---

### D. Encapsulation (Data Hiding)
* **Concept:** Keeping object fields `private` or `protected` and providing access only through public `getters` and `setters`.
* **Where to show in VS Code:**
  * Open **`Student.java`**:
    ```java
    private String name;
    private String studentId;
    private String email;

    public String getName() { return name; }
    public String getStudentId() { return studentId; }
    public String getEmail() { return email; }
    ```
  * Open **`FoundItem.java`**:
    ```java
    private boolean claimed;
    public boolean isClaimed() { return claimed; }
    public void setClaimed(boolean claimed) { this.claimed = claimed; }
    ```
  * *Viva Explanation:* External classes cannot arbitrarily modify fields directly; they must go through controlled accessor methods.

---

### E. Java Collections Framework (`ArrayList`, `HashMap`)
* **Concept:** Dynamic data structures used to store and manipulate collections of objects in memory.
* **Where to show in VS Code:**
  * Open **`LostAndFoundSystem.java`**:
    ```java
    private ArrayList<LostItem> lostItems = new ArrayList<>();
    private ArrayList<FoundItem> foundItems = new ArrayList<>();
    ```
  * Open **`WebServer.java`**:
    ```java
    private Map<String, Account> accounts = new HashMap<>();
    private Map<String, Session> sessions = new ConcurrentHashMap<>();
    private Map<Item, String> photos = new HashMap<>();
    private ArrayList<OwnershipRequest> requests = new ArrayList<>();
    ```

---

## 4. File-by-File Guide (What Each File Does)

| File Name | Role | What Code is Inside |
| :--- | :--- | :--- |
| **`Item.java`** | **OOP Model (Parent)** | Abstract class defining common item properties (`name`, `category`, `location`, `time`, etc.). |
| **`LostItem.java`** | **OOP Model (Child)** | Inherits from `Item`, adds `dateLost`, overrides `displayItem()`. |
| **`FoundItem.java`** | **OOP Model (Child)** | Inherits from `Item`, adds `id`, `dateFound`, `claimed`, `contactNumber`. |
| **`Student.java`** | **OOP Model** | Represents a campus student with ID, Name, and Email validation. |
| **`LostAndFoundSystem.java`** | **Core Logic / Engine** | Contains `calculateMatchScore()`, `getMatchingItems()`, and `ArrayList` operations. |
| **`WebServer.java`** | **Backend Web Controller** | Built-in HTTP server, REST endpoints (`/api/...`), session cookies, and binary file save/load. |
| **`Main.java`** | **Console CLI Demo** | Terminal menu (options 1 to 7) to run the project entirely inside the terminal without a browser. |
| **`lost-and-found.html`** | **Frontend Layout & CSS** | Single HTML file containing responsive CSS, CSS variables, dark/light theme, and layout container. |
| **`app.js`** | **Frontend Logic** | Single-page UI rendering, form submission, tags, image file reading, and `fetch()` calls to Java. |
| **`data/lost-found.bin`** | **Local Database File** | Serialized binary file storing all accounts, reports, and ownership requests between restarts. |

---

## 5. Top Viva Questions & One-Line Answers

### Q1. "Why didn't you use SQL / MySQL / SQLite?"
> **Answer:** *"The goal was to demonstrate core Java OOP concepts—such as `ArrayList`, object references, and native Java Object Serialization—without depending on external database servers or JDBC drivers."*

### Q2. "How does the matching algorithm work?"
> **Answer:** *"In `LostAndFoundSystem.java`, `calculateMatchScore()` evaluates 4 attributes: Name (40 points), Category (20 points), Location (20 points), and Date (20 points) for a maximum of 100 points. Any unclaimed found item scoring 50 points or more is returned as a possible match."*

### Q3. "How do you protect the finder's contact number?"
> **Answer:** *"Privacy is preserved by default. When an item is found, the finder's phone number is hidden. A claimant must click 'Claim ownership' and submit private identifying details. Only after the finder reviews and approves the claim does the server reveal the phone number to that specific student."*

### Q4. "What happens if the Java server restarts? Is data lost?"
> **Answer:** *"No. All accounts, lost/found items, photos, and ownership claims are saved to `data/lost-found.bin` using Java Serialization. When the server restarts, `loadData()` automatically restores everything."*

### Q5. "Why can't a user claim their own found item?"
> **Answer:** *"The server checks if `foundItem.getReportedBy()` matches the logged-in student. Self-claiming is disabled to prevent students from falsely claiming items they found themselves. To demonstrate claiming, we test using two different student accounts in separate browser windows."*
