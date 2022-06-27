
/**------------------------------------------------------------------------
 *                           Gmail API response
 *------------------------------------------------------------------------**/

export interface APIMessageResponse {
  id: string;
  threadId: string;
  labelIds: ["INBOX" | "IMPORTANT" | "SENT"];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: APIMessagePart;
  sizeEstimate: number;
  raw: string;
}

export interface APIMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: [
    {
      name: string;
      value: string;
    }
  ];
  body: {
    attachmentId: string;
    size: number;
    data: string;
  };
  parts: [APIMessagePart];
}

/**------------------------------------------------------------------------
 *                           Custom Types
 *------------------------------------------------------------------------**/

export interface SearchResult {
  id: string;
  threadId: string;
}

export interface Attachment {
  mimeType: string;
  filename: string;
  size: number;
}

export interface Message {
  isLoaded: boolean;
  id: string;
  snippet?: string;
  recievedDate?: Date;
  subject?: string;
  from?: string;
  to?: string;
  attachments?: Attachment[];
  labels?: APIMessageResponse["labelIds"];
}
