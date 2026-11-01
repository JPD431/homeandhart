import NotFoundContent from "@/app/components/NotFoundContent";

export const metadata = {
  title: "Error 404",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent />;
}
