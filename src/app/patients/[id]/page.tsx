import { PatientDetailView } from "@/components/patient/PatientDetailView";

export default async function PatientPage(props: PageProps<"/patients/[id]">) {
  const { id } = await props.params;
  return <PatientDetailView patientId={id} />;
}
