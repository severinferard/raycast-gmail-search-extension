import { ActionPanel, Detail, List, Action, showToast, Toast, Icon, Color, useNavigation } from "@raycast/api";
import { useState, useEffect, useRef, useCallback, FunctionComponent } from "react";
import fetch, { AbortError } from "node-fetch";

import * as service from "./oauth";
import { SearchResult, Message } from "./types";
import { getMessage, searchMails} from "./api"


interface MailDetailsProps {
  message: Message
}

const MailDetails: FunctionComponent<MailDetailsProps> = ({message}) => {
  const markdown = `
  ## ${message.subject}
  
  `;
  return <Detail navigationTitle="message.subject" markdown={markdown}>hello</Detail>
}

const MailSearchList: FunctionComponent = () => {
  const { state, search } = useSearch();
  const [results, setResults] = useState<Message[]>([]);

  // const [selectedId, setSelectedId] = useState("");

  const { push } = useNavigation();

  // Whenever new search results are found, asynchronously fetch the content
  // of each message and update the associeted item in the list.
  useEffect(() => {
    state.results.forEach((searchResult, i) => {
      getMessage(searchResult.id).then(message => {
        setResults(current => {
          current[i] = message;
          return [...current];
        })
      })
    })
  }, [state.results])
  // whenever a search finishes, reset the results displayed to the new results found with unloaded content.
  useEffect(() => {
    if (state.isLoading === false)
      setResults(state.results.map((res) => ({ id: res.id, isLoaded: false })))
  }, [state.isLoading])

  // Fetch the authorization token when the extension is opened.
  useEffect(() => {
    service.authorize()
      .then(() => {
        search("");
      })
      .catch(e => console.error(e))
  }, []);


  return (
    <List isLoading={state.isLoading || !results.every(msg => msg.isLoaded)}
      onSearchTextChange={search}
      searchBarPlaceholder="Search Gmail ..."
      throttle
      searchBarAccessory={<List.Dropdown

        tooltip="Select Account"
        storeValue={true}
        // onChange={(newValue) => {
        //   onDrinkTypeChange(newValue);
        // }}
      >
        {/* <List.Dropdown.Section title="Alcoholic Beverages"> */}
        <List.Dropdown.Item
            key={""}
            title={"drinkType.name"}
            value={"drinkType.id"}
          />
        {/* </List.Dropdown.Section> */}
      </List.Dropdown>}
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {/* {results.filter(message => message.isLoaded).map((message) => SearchListItem(message, () => {
          console.log('here', message)
          push(<MailDetails message={message}/>)
        }))} */}
        {results.map((message) => {
          if (message.isLoaded)
            return SearchListItem(message, () => {push(<MailDetails message={message}/>)})
          else
            return <List.Item title={""} subtitle="Loading ..." key={message.id} id={message.id}/>
        })}
      </List.Section>
    </List>
  );


}

export default function Command() {
  return <MailSearchList/>;
}

function formatSender(sender: string) {
  if (sender[0] === '"') {
    return sender.split('"')[1];
  } else {
    return sender.split(" ")[0]
  }
}

function chooseIcon(labels: Message['labels']) {
  if (labels?.includes("IMPORTANT"))
    return {source: Icon.Star, tintColor: Color.Yellow};
  if (labels?.includes("INBOX"))
    return {source: Icon.Envelope, tintColor: Color.Blue};
  if (labels?.includes("SENT"))
    return {source: "sent-icon.png", tintColor: Color.Green};
}

function SearchListItem(message: Message, onSelect: () => void) {
  const accessories: List.Item.Accessory[] = [{ text: message.recievedDate?.toDateString()}];
  if (message.attachments?.length)
    accessories.unshift({ icon: "paperclip.svg", text: message.attachments?.length.toString(), })

  return (
    <List.Item
      title={formatSender(message.from!)}
      icon={chooseIcon(message.labels)}
      subtitle={message.snippet!}
      key={message.id}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
          <Action title="Details" onAction={onSelect}></Action>
          <Action.OpenInBrowser title="Open in Browser" url={'https://mail.google.com/mail/u/0/#all/' + message.id} />
          <Action title="Add Account" onAction={onSelect} icon={Icon.Plus}></Action>
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
      console.log("search")
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState: SearchState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await searchMails(searchText);
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
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}