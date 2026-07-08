# BringUp Assignment Flowcharts

These Mermaid diagrams describe the main implementation flows for the characterization document.

## Client Onboarding Flow

```mermaid
flowchart TD
  A["Lead created manually or via intake form"] --> B["Admin or accountant reviews lead"]
  B --> C["Assign accountant"]
  C --> D["Send onboarding questionnaire"]
  D --> E["Onboarding Status: Questionnaire Sent"]
  E --> F["Client returns questionnaire and documents"]
  F --> G["Staff marks Documents Received"]
  G --> H["Document Check"]
  H --> I{"Documents complete and valid?"}
  I -->|No| J["Fill Missing Information"]
  J --> K["Client sees request in portal"]
  K --> L["Client submits response"]
  L --> M["Staff reviews response"]
  M --> H
  I -->|Yes| N["Staff sets Onboarding Status: File Opened"]
  N --> O["Make generates engagement letter"]
  O --> P["Make sends engagement letter"]
  P --> Q["Staff confirms readiness"]
  Q --> R["Onboarding Status: Active"]
  R --> S["monday creates linked ongoing tasks"]
```

## Engagement Letter Make Flow

```mermaid
flowchart TD
  A["Onboarding Status changes to File Opened"] --> B["Make scenario starts"]
  B --> C["Watch updated item on Clients board"]
  C --> D["Get full client file from monday"]
  D --> E{"Router branch"}
  E -->|File Opened and letter not created/sent| F["Create Hebrew Google Docs engagement letter"]
  F --> G["Save generated document URL to monday"]
  G --> H["Set Engagement Letter Status: Created"]
  E -->|Created plus email and link exist| I["Send Hebrew Gmail message"]
  I --> J["Set Engagement Letter Status: Sent"]
  E -->|Required data missing| K["Skip branch and keep current state"]
```

## Ongoing Task And Client Request Flow

```mermaid
flowchart TD
  A["Client file becomes Active"] --> B["monday creates ongoing task instances"]
  B --> C["Task linked to client file"]
  C --> D["Owner starts work"]
  D --> E{"Client input needed?"}
  E -->|No| F["Continue internal work"]
  F --> G{"Task complete?"}
  G -->|No| D
  G -->|Yes| H["Task Status: Done"]
  E -->|Yes| I["Task Status: Waiting for Client"]
  I --> J["Add Missing Information / Client Request"]
  J --> K["Linked client file shows response-needed indicator"]
  K --> L["Portal shows open request to client"]
  L --> M["Client submits response or action confirmation"]
  M --> N["Client Response and Last Client Update saved on client file"]
  N --> O["Assigned accountant is notified"]
  O --> P["Staff reviews response"]
  P --> Q{"Response resolves request?"}
  Q -->|No| J
  Q -->|Yes| R["Task Status: In Progress"]
  R --> F
```

## Client Portal Flow

```mermaid
flowchart TD
  A["Client opens Vercel portal"] --> B["Enter Legal/Tax ID"]
  B --> C["Portal queries monday API"]
  C --> D{"Matching client file found?"}
  D -->|No| E["Show friendly not-found message"]
  D -->|Yes| F["Load client-facing file status"]
  F --> G["Load open tasks and requests"]
  G --> H["Hide internal notes, dashboards, item IDs, and other clients"]
  H --> I["Show status and open requests in plain language"]
  I --> J{"Client has a response to submit?"}
  J -->|No| K["Client leaves portal"]
  J -->|Yes| L["Client submits limited response"]
  L --> M["Portal updates monday client-response fields"]
  M --> N["Portal records response details and timestamp"]
  N --> O["Notify assigned accountant for review"]
  O --> P["Staff decides next internal status"]
```
