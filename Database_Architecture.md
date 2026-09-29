# Database Architecture

The backend of the MIME-Based Multimedia Email Handler uses **SQLite**, a file-based relational database. The schema is highly normalized to ensure data integrity, avoid redundancy, and optimize performance.

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ EMAILS : "sends"
    USERS ||--o{ RECIPIENTS : "receives"
    EMAILS ||--o{ RECIPIENTS : "has"
    EMAILS ||--o{ ATTACHMENTS : "contains"

    USERS {
        INTEGER id PK "Primary Key"
        TEXT username "Unique"
        TEXT password_hash "PBKDF2 HMAC"
        TIMESTAMP created_at 
    }
    EMAILS {
        INTEGER id PK
        INTEGER sender_id FK "Links to USERS.id"
        TEXT subject
        TEXT body_text
        TIMESTAMP timestamp
    }
    RECIPIENTS {
        INTEGER email_id PK,FK
        INTEGER user_id PK,FK
        BOOLEAN is_read
        BOOLEAN is_deleted
    }
    ATTACHMENTS {
        INTEGER id PK
        INTEGER email_id FK "Links to EMAILS.id"
        TEXT filename "e.g., photo.png"
        TEXT mime_type "e.g., image/png"
        TEXT file_path "Stored on Disk"
    }
```

## Table Breakdowns

### 1. `users` Table
Stores registered users and authentication credentials.
* **`id`**: Unique identifier for the user.
* **`username`**: The login handle. Must be unique.
* **`password_hash`**: Secure cryptographic hash of the password. Plain-text passwords are never stored.
* **`created_at`**: UTC timestamp of registration.

### 2. `emails` Table
Stores the core content of the messages.
* **`id`**: Unique identifier for the email.
* **`sender_id`**: Foreign key pointing to the user who sent it.
* **`subject`**: Subject line.
* **`body_text`**: Main text payload.
* **`timestamp`**: Time of sending in UTC.

### 3. `recipients` Table (The Join Table)
Because an email can be sent to multiple users, we don't duplicate the heavy email body. We map it here.
* **`email_id`**: Links to the email.
* **`user_id`**: Links to the recipient user.
* **`is_read`**: Tracks if this specific user has opened the email (0=False, 1=True).
* **`is_deleted`**: Tracks if this specific user deleted the email from their inbox (soft delete).

### 4. `attachments` Table
Stores metadata for binary attachments. The actual binary blobs are saved to the server's filesystem, not the database.
* **`id`**: Unique attachment identifier.
* **`email_id`**: Links to the email this file belongs to.
* **`filename`**: Original file name.
* **`mime_type`**: The MIME type (e.g. `application/pdf`).
* **`file_path`**: The absolute or relative path to where the file is physically stored on the hard drive.

---

## Data Flow: Sending an Email

When a user sends an email with attachments to multiple recipients, the database executes a **Transaction** across three tables simultaneously:

```mermaid
flowchart TD
    Start["User Clicks Send"] --> E["INSERT into EMAILS<br/>(subject, body, sender_id)"]
    E --> |"Returns new Email ID"| R["Loop through Recipients"]
    R --> R1["INSERT into RECIPIENTS<br/>(email_id, user_id, is_read=0)"]
    R1 --> A{"Has Attachments?"}
    A -- "Yes" --> FS["Save Binary File to Hard Drive"]
    FS --> A1["INSERT into ATTACHMENTS<br/>(email_id, filename, file_path)"]
    A1 --> Commit[("COMMIT Transaction")]
    A -- "No" --> Commit
    
    Commit --> Done["Success Response to Frontend"]
```
