import Image, { type ImageProps } from "next/image";
import { toAniziumAssetProxyUrl } from "@/lib/anizium/asset-proxy";

type Props = Omit<ImageProps, "src"> & {
  src: ImageProps["src"] | string;
};

export function AniziumImage({ src, ...props }: Props) {
  const resolvedSrc = typeof src === "string" ? toAniziumAssetProxyUrl(src) : src;
  return <Image {...props} src={resolvedSrc} alt={props.alt} />;
}
