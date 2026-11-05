import React from 'react';
import './StartupScreen.css';

export default function StartupScreen({error='',connecting=false,onRetry}) {
 return <main className="startup-screen" aria-labelledby="startup-title">
  <div className="startup-content">
   <div className="startup-mark" aria-hidden="true"><span className="startup-orbit" data-paused={!!error}/><img src="./icon.svg" alt="" width="56" height="56"/></div>
   <h1 id="startup-title">Opening RiftTask</h1>
   <p className="startup-status" role="status">{error?'Workspace unavailable':'Loading workspace…'}</p>
   {error&&<div className="startup-recovery"><p role="alert">{error}</p><button type="button" disabled={connecting} onClick={onRetry}>Retry loading</button></div>}
  </div>
 </main>;
}
