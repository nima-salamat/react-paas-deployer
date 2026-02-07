import { useParams } from "react-router-dom";

export default function ServiceDetail() {
  const { id } = useParams();

  return (
    <div>
      <h2>Service Detail</h2>
      <p>Service ID: {id}</p>
    </div>
  );
}
