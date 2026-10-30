import type { WidgetProps } from "@/types/service";
import DownloaderGetDownloadList from "@/widgets/openmediavault/methods/downloader_get_downloadlist";
import ServicesGetStatus from "@/widgets/openmediavault/methods/services_get_status";
import SmartGetList from "@/widgets/openmediavault/methods/smart_get_list";

export default function Component({ service }: WidgetProps) {
    switch (service.widget.method) {
        case "services.getStatus":
            return <ServicesGetStatus service={service} />;
        case "smart.getListBg":
            return <SmartGetList service={service} />;
        case "downloader.getDownloadList":
            return <DownloaderGetDownloadList service={service} />;
        default:
            return null;
    }
}
