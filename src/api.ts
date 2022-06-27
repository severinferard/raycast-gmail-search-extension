import { APIMessageResponse, Message, SearchResult,  } from "./types"
import { client } from "./oauth";
import fetch from "node-fetch";

export async function searchMails(query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    params.append("q", query);
  
    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages?" + params.toString(), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await client.getTokens())?.accessToken}`,
      },
    });
  
    let json = await response.json();
  
    if (response.ok) {
      let { messages } = json as { messages: { id: string; threadId: string }[] };
      return messages === undefined ? [] : messages;
    }
  
    throw new Error((json as { error: { message: string } }).error.message);
  }
  
  export async function getMessage(id: string): Promise<Message> {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + id, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await client.getTokens())?.accessToken}`,
      },
    });
    let json = (await response.json()) as APIMessageResponse;
    
    const message: Message = {
      isLoaded: true,
      id: json.id,
      snippet: json.snippet,
      labels: json.labelIds,
      recievedDate: new Date(json.payload.headers.find((e) => e.name === "Date")?.value!),
      subject: json.payload.headers.find((e) => e.name === "Subject")?.value,
      to: json.payload.headers.find((e) => e.name === "To")?.value,
      from: json.payload.headers.find((e) => e.name === "From")?.value,
      attachments: json.payload.parts
        ?.filter((part) => part.filename)
        .map((part) => (
          { filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          }
        )),
    };
    return message;
  }
  