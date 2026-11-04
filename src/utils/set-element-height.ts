// The collapse animation runs on a ref that is empty until the panel mounts
export default function setElementHeight(element: HTMLElement | null, height: string) {
    if (element) element.style.height = height;
}
