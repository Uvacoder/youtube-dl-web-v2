import { useMutation } from "@tanstack/react-query";
import { isNil, sortBy } from "lodash";
import React from "react";
import { GitHub } from "react-feather";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { RadialProgress } from "../components/radial-progress";
import { VideoCard } from "../components/video-card";
import { DownloadProgress, download } from "../utils/download";
import { formatBytes } from "../utils/misc";
import { tinyassert } from "../utils/tinyassert";
import { useReadableStream } from "../utils/use-readable-stream";
import { VideoInfo, getThumbnailUrl } from "../utils/youtube-utils";
import { useMetadata } from "./api/metadata.api";

export default function Page() {
  const idForm = useForm({
    defaultValues: {
      id: "",
    },
  });
  const metadataQuery = useMetadata({
    onSuccess: () => {},
    onError: () => {
      toast.error("failed to fetch video info");
    },
  });

  return (
    <div className="h-full flex flex-col items-center">
      <div className="w-xl max-w-full flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl">Youtube DL Web</h1>
          <a
            className="flex items-center"
            href="https://github.com/hi-ogawa/youtube-dl-web"
            target="_blank"
          >
            <GitHub className="w-6 h-6" />
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <span>Video ID</span>
          <form
            className="flex items-center relative"
            onSubmit={idForm.handleSubmit((data) => {
              metadataQuery.mutate(data);
            })}
          >
            <input
              className="border px-1 w-full"
              placeholder="ID or URL"
              {...idForm.register("id")}
            />
            {metadataQuery.isLoading && (
              <div className="absolute right-4 w-4 h-4 spinner"></div>
            )}
          </form>
        </div>
        {!metadataQuery.isSuccess && <MainFormSkelton />}
        {metadataQuery.isSuccess && (
          <MainForm videoInfo={metadataQuery.data.videoInfo} />
        )}
      </div>
    </div>
  );
}

//
// MainForm
//

function MainForm({ videoInfo }: { videoInfo: VideoInfo }) {
  // filter only webm audio
  const formats = sortBy(
    videoInfo.formats.filter(
      (f) => f.acodec !== "none" && f.ext === "webm" && f.filesize
    ),
    (f) => f.filesize
  ).reverse();

  const form = useForm({
    defaultValues: {
      format_id: formats[0]?.format_id,
      title: videoInfo.title,
      artist: videoInfo.artist ?? videoInfo.uploader,
      album: videoInfo.album,
      embedThumbnail: true,
    },
  });

  const [downloadStream, setDownloadStream] =
    React.useState<ReadableStream<DownloadProgress>>();

  const [downloadUrl, setDownloadUrl] = React.useState<string>();
  const [downloadProgress, setDownloadProgress] = React.useState<number>();

  useReadableStream({
    stream: downloadStream,
    onRead: (res) => {
      if (res.done) {
        return;
      }
      const { result, offset, total } = res.value;
      if (offset === total) {
        const url = URL.createObjectURL(new Blob([result]));
        setDownloadUrl(url);
      }
      setDownloadProgress(offset / total);
    },
    onError: () => {
      toast.error("failed to download", { id: "downloadStream:onError" });
    },
  });

  const downloadQuery = useMutation(
    async (format_id?: string) => {
      tinyassert(format_id);
      return download(videoInfo, format_id);
    },
    {
      onSuccess: (stream) => {
        if (downloadUrl) {
          URL.revokeObjectURL(downloadUrl);
        }
        setDownloadProgress(0);
        setDownloadStream(stream);
      },
      onError: () => {
        toast.error("failed to download", { id: "downloadQuery:onError" });
      },
    }
  );

  React.useEffect(() => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
  }, []);

  return (
    <>
      <VideoCard
        imageUrl={getThumbnailUrl(videoInfo.id)}
        title={videoInfo.title}
        uploader={videoInfo.uploader}
      />
      <div className="flex flex-col gap-2">
        <span>Audio</span>
        <select
          className="border px-1 bg-white"
          {...form.register("format_id")}
        >
          {formats.map(
            (f) =>
              f.filesize && (
                <option key={f.format_id} value={f.format_id}>
                  {formatBytes(f.filesize)}
                </option>
              )
          )}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <span>Title</span>
        <input className="border px-1" {...form.register("title")} />
      </div>
      {/* TODO: save history for quick input */}
      <div className="flex flex-col gap-2">
        <span>Artist</span>
        <input className="border px-1" {...form.register("artist")} />
      </div>
      <div className="flex flex-col gap-2">
        <span>Album</span>
        <input className="border px-1" {...form.register("album")} />
      </div>
      <div className="flex gap-4">
        <span>Embed Thumbnail</span>
        <input type="checkbox" {...form.register("embedThumbnail")} />
      </div>
      {!downloadUrl && (
        <button
          className="p-1 border bg-gray-300 filter transition duration-200 hover:brightness-95 disabled:(pointer-events-none text-gray-500 bg-gray-200)"
          onClick={form.handleSubmit((data) =>
            downloadQuery.mutate(data.format_id)
          )}
          disabled={!isNil(downloadProgress)}
        >
          <div className="flex justify-center items-center relative">
            {isNil(downloadProgress) && <span>Download</span>}
            {!isNil(downloadProgress) && <span>Downloading...</span>}
            {!isNil(downloadProgress) && (
              <RadialProgress
                progress={downloadProgress}
                className="absolute right-2 w-6 h-6 text-blue-600"
                classNameBackCircle="text-blue-300"
              />
            )}
          </div>
        </button>
      )}
      {downloadUrl && (
        <a
          className="p-1 border bg-blue-300 filter transition duration-200 hover:brightness-95 cursor-pointer"
          href={downloadUrl}
          download={"test.opus"}
        >
          <div className="flex justify-center items-center relative">
            <span>Finished!</span>
          </div>
        </a>
      )}
    </>
  );
}

function MainFormSkelton() {
  return (
    <>
      <VideoCard
        // taken from https://roadmaptoprofit.com/process-power-pack-for-businesses/video-placeholder/
        imageUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACoCAMAAABt9SM9AAAAG1BMVEXd3d3MzMzOzs7b29vU1NTY2NjS0tLW1tbf399oO5GCAAAE/ElEQVR4nO2dWYKDIBBEHRDk/iceURsVt24UFVPvc8YYKGgo1lQVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACScCs8naY30KrgqkEN3WI8zQrdP/wTVS9m97HqJzTsq0orTVPXVin1J6T9iK3rxujxZd+kzZoxXiKpQlu62boV7YuCtULVF6kUaVabjwWl03mUGrDmS3LVGZXqUObpLF5GzlpFNN+oXG6pVQ71PhGKzq5lzXuAzgR0Lmp4cpX+f70T84ZjszvVz+XxKpyZi2RtK5Cu5v78qP+fPDj42FY3O4hG2qmc2biJsR74Xv4yJ9mL1vq2sSDq0gPRNVT8VufwQ87pJhTH9a+/GcqJzVfsWn2jalHFytugmDu+5AaoSclrGu/5ltzoe8qcqlbGWM+Po3FObsdIrVbeb8mMvScTbdOobimUnFAUWsazp+aQ6YtK7g+NIAoba026XOTmUz//PDQs5GShy63ViWpR41iwWFTex1EYeoLUOAp1OO3jL4DfkkymcdLa6PIbLX6TNZ3zskljSHYlfikhthiPzuaomkqsl6R5fCWCDESzqUoci2F2Iymlb4BC4zjni6lncb9IIZ/anz7OGFVHrMzTC1cgNHn4xLQ+jKMeipH+FbH+lKyS8EvmlfSRoTgrCSTWfDFC0rXRG+rk5D5KmPjjPBuyOl8L4jf0jt9AvpEwBGEkf8yqM/PKxY3Fwr0DJZ9T1qFm+a1X88X+mue5JEXzQiSBMRHL9wyzWOSZrsKN1kwA2bNxLHIqFxmtk6l+iiH1HMO0FDaOxUO+IRbHJi7FcnpWudThEm2w8CdT/RCC1K+FbLAeFIv76KLFkqR+tX2LG/r9eP5xsRYN/f4ASBD17+MCsZama0etosWSdE/bNiNq6HdCEWJNX9RF4vY7IFb3TwOxpuyKNe0TdwwExHLV3G3t9Ic/L1bsHfaUKFqs89ZhOVuzx2+LFe0Ktwcv+oRYaQPp2GAdzjCXPdw5Nesgi0DPN2YdOItTsViiQWFP4WIlz5TKphsGyp78S52Dd9FEFnPFQrDw9kJSV3fkEdi9ofDVnYR1w1as+Sore8dD6euGKSvSkbXi79MK9fhEip9E0D+NG0MmMagku5cL3+sg2QW0totGuD2U4jYxsY/Db3eWYh0NbmIk44VXwt8UOxdLJeyTFOxveiWhgxLXLKa1mr6gbJsl2qsxE0u45a9/QdnOoZIcewhiqdTrLMrey+Zh92vj5Q9pRwZC+17uxSFhp+jxo0MlTL1TxpV/dofmpBSji6r7epF6KuymU6A5EZw3dLo5UyuoDhcbhdV9x4+oVIr179UkOjJbxbu+Jyuh3c19DLD8U78ecgRZzx+Fs3rlGgdPiI+8ZpEmdkqOwmo0ixkL3QX7X7B97xiteZPnhkw3WYwt9qxhgHLyp2x/I9tVL+5vaLPjELz0ilVFu/+V7e/6dcM1yWIcXS2iTRPf/ld4i+VZmzH+665H9LdMa7ol+QD/lL8ksWk2r0gsuysk1nK2pt8WvM9/IAg9mpndU9iP3EgdL5xmQD5n/2JM1sqlSh4/L3GVbvJUL2WbLHd6Pk53d/6VOtXmA3ZhC/pVhu3+nyFR5zqMqY5vGf4C/U92DDntbpjuftqj7rAT+r/Q736Mluy6S4dLhGdKAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAg4B88gCS4KbIjZAAAAABJRU5ErkJggg=="
        title={<span className="text-gray-400">.........</span>}
        uploader={<span className="text-gray-400">.....</span>}
      />
      <div className="flex flex-col gap-2">
        <span>Audio</span>
        <select className="border px-1" disabled></select>
      </div>
      <div className="flex flex-col gap-2">
        <span>Title</span>
        <input className="border px-1" disabled />
      </div>
      <div className="flex flex-col gap-2">
        <span>Artist</span>
        <input className="border px-1" disabled />
      </div>
      <div className="flex flex-col gap-2">
        <span>Album</span>
        <input className="border px-1" disabled />
      </div>
      <div className="flex gap-4">
        <span>Embed Thumbnail</span>
        <input type="checkbox" disabled />
      </div>
      <button
        className="p-1 border bg-gray-300 filter transition duration-200 hover:brightness-95 disabled:(pointer-events-none text-gray-500 bg-gray-200)"
        disabled
      >
        <div className="flex justify-center items-center relative">
          Download
        </div>
      </button>
    </>
  );
}
