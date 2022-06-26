import { OAuth, showToast, Toast } from "@raycast/api";
import fetch from "node-fetch";
import { json } from "stream/consumers";

// Create an OAuth client ID via https://console.developers.google.com/apis/credentials
// As application type choose "iOS" (required for PKCE)
// As Bundle ID enter: com.raycast
const clientId = "785335863573-k3hu4b0jisu4jhs3c2qknlri5ettm6s4.apps.googleusercontent.com";

const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.AppURI,
  providerName: "Google",
  providerIcon: "gmail-logo.png",
  providerId: "google",
  description: "Connect your Gmail account\n(Raycast Gmail Search)",
});

// Authorization

export async function authorize(): Promise<void> {
  const tokenSet = await client.getTokens();

  if (tokenSet?.accessToken) {
    // If we have a token

    if (tokenSet.refreshToken && tokenSet.isExpired()) {
      // If the token is expired
      const newToken = await refreshTokens(tokenSet.refreshToken);
      if (newToken)
        await client.setTokens(newToken);
    }

    // Check that the token is valid
    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile?", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await client.getTokens())?.accessToken}`,
      },
    });
    if (response.status === 200) return; // Token valid
  }
  // If we don't have a token or the token is invalid
  const authRequest = await client.authorizationRequest({
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: clientId,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  });
  const { authorizationCode } = await client.authorize(authRequest);
  await client.setTokens(await fetchTokens(authRequest, authorizationCode));
}

async function fetchTokens(authRequest: OAuth.AuthorizationRequest, authCode: string): Promise<OAuth.TokenResponse> {
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("code", authCode);
  params.append("verifier", authRequest.codeVerifier);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", authRequest.redirectURI);

  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params });
  if (!response.ok) {
    console.error("fetch tokens error:", await response.text());
    throw new Error(response.statusText);
  }
  return (await response.json()) as OAuth.TokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<OAuth.TokenResponse | null> {
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params });
  if (!response.ok) {
    console.error("refresh tokens error:", await response.text());
    return null;
  }
  const tokenResponse = (await response.json()) as OAuth.TokenResponse;
  tokenResponse.refresh_token = tokenResponse.refresh_token ?? refreshToken;
  return tokenResponse;
}

// API

export interface SearchResult {
  id: string;
  threadId: string;
}

interface Attachment {
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
}

interface APIMessagePart {
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

interface APIMessageResponse {
  id: string;
  threadId: string;
  labelIds: [string];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: APIMessagePart;
  sizeEstimate: number;
  raw: string;
}

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

  showToast({
    style: Toast.Style.Failure,
    title: "Gmail Response Error",
    message: (json as { error: { message: string } }).error.message,
  });
  return [];
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
    recievedDate: new Date(json.payload.headers.find((e) => e.name === "Date")?.value!),
    subject: json.payload.headers.find((e) => e.name === "Subject")?.value,
    to: json.payload.headers.find((e) => e.name === "To")?.value,
    from: json.payload.headers.find((e) => e.name === "From")?.value,
    attachments: json.payload.parts
      ?.filter((part) => part.filename)
      .map((part) => ({ filename: part.filename, mimeType: part.mimeType, size: part.body.size })),
  };
  return message;
}
