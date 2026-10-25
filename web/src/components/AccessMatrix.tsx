import { accessMatrix } from '../accessMatrix'
export default function AccessMatrix() {
 return <section style={{ color: '#12304a', background: '#f8fbff', borderRadius: 12, padding: 20, marginBottom: 20 }}>
  <h3 style={{ marginTop: 0 }}>Phase 1 · Features Access Matrix</h3>
  <p>✓ Manage / Perform · V View Only · Own Own Records Only · — No Access</p>
  <p>Supervisor access is limited to assigned sites and clients. Config means technical configuration only; it does not grant access to operational records.</p>
  <p>Permission design: listing a feature here does not mean its production integration is active. BCC confirmation pending: training/certification ownership, equipment maintenance and final incident approvals.</p>
  {accessMatrix.map(group => <div key={group.title} style={{ marginTop: 20 }}><h4>{group.title}</h4><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
   <thead><tr>{['Feature','Guards','Supervisor','SSD','System Admin'].map(label => <th key={label} scope="col" style={{ textAlign: 'left', padding: 10, background: '#e0edf8' }}>{label}</th>)}</tr></thead>
   <tbody>{group.rows.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row" style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #dbe5ef', fontWeight: 500 }}>{cell}</th> : <td key={i} style={{ padding: 10, borderBottom: '1px solid #dbe5ef' }}>{cell}</td>)}</tr>)}</tbody>
  </table></div></div>)}
 </section>
}
