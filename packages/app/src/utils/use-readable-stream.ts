import React from "react";

// vscode is fine but local tsc doesn't see `ReadableStreamDefaultReadResult<T>`
type ReadResult<T> = Awaited<
  ReturnType<ReturnType<ReadableStream<T>["getReader"]>["read"]>
>;

// TODO: not concurrent-react safe
// TODO: workaround fast-refresh
export function useReadableStream<T>({
  stream,
  onRead,
  onSuccess,
  onError,
}: {
  stream?: ReadableStream<T>;
  onRead?: (arg: ReadResult<T>) => void;
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
}) {
  const onReadRef = useStableRef(onRead);
  const onErrorRef = useStableRef(onError);
  const onSuccessRef = useStableRef(onSuccess);

  React.useEffect(() => {
    if (!stream) {
      return;
    }
    const reader = stream.getReader();
    let done = false;

    // pull data and invoke callback
    (async () => {
      while (!done) {
        const read = await reader.read();
        onReadRef.current?.(read);
        if (read.done) {
          break;
        }
      }
    })();

    // watch for finish/error
    (async () => {
      try {
        await reader.closed;
        onSuccessRef.current?.();
      } catch (e) {
        onErrorRef.current?.(e);
      }
    })();

    return () => {
      done = true;
      reader.cancel();
    };
  }, [stream]);
}

function useStableRef<T>(value: T) {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}
