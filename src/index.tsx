import { ActionPanel, Detail, List, Action, showToast, Toast, Icon, useNavigation } from "@raycast/api";
import { useState, useEffect, useRef, useCallback, FunctionComponent } from "react";
import fetch, { AbortError } from "node-fetch";

import * as service from "./oauth";
import { SearchResult, Message } from "./oauth";

function formatSender(sender: string) {
  if (sender[0] === '"') {
    return sender.split('"')[1];
  } else {
    return sender.split(" ")[0]
  }
}

interface MailDetailsProps {
  message: Message
}

const MailDetails: FunctionComponent<MailDetailsProps> = ({message}) => {
  const markdown = `
  ## ${message.subject}
  
  `;
  return <Detail navigationTitle="message.subject" markdown={markdown}>hello</Detail>
}

function MailSearchList() {
  const { state, search } = useSearch();
  const [results, setResults] = useState<Message[]>([]);

  const { push } = useNavigation();


  useEffect(() => {
    state.results.forEach((searchResult, i) => {
      service.getMessage(searchResult.id).then(message => {
        setResults(current => {
          current[i] = message;
          return [...current];
        })
      })
    })
  }, [state.results])

  useEffect(() => {
    if (state.isLoading === false)
      setResults(state.results.map((res) => ({ id: res.id, isLoaded: false })))
  }, [state.isLoading])

  useEffect(() => {
    service.authorize().catch(e => console.error(e))
  }, []);


  return (
    <List isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search your Gmail inbox..."
      throttle
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {results.filter(message => message.isLoaded).map((message) => SearchListItem(message, () => {
          console.log('here', message)
          push(<MailDetails message={message}/>)
          // setSelectedMessage(message);
          // setIsShowingDetails(true);
        }))}
      </List.Section>
    </List>
  );


}

export default function Command() {
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  return MailSearchList();
}

function SearchListItem(message: Message, onSelect: () => void) {
  const accessories: List.Item.Accessory[] = [{ text: message.recievedDate?.toDateString()}];
  if (message.attachments?.length)
    accessories.unshift({ icon: "paperclip.svg", text: message.attachments?.length.toString() })

  return (
    <List.Item
      title={formatSender(message.from!)}
      subtitle={message.snippet!}
      key={message.id}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
          <Action title="Details" onAction={onSelect}></Action>
            <Action.OpenInBrowser title="Open in Browser" url={'https://mail.google.com/mail/u/0/#all/' + message.id} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    ><Detail.Metadata.TagList.Item text="Electric" color={"#eed535"} /></List.Item>
  );
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
};

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState: SearchState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await service.searchMails(searchText);
        setState((oldState: SearchState) => ({
          ...oldState,
          results: results,
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState: SearchState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}