import {act,renderHook} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {useAppearance} from './appearance.js';
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('falls back from invalid preferences, follows system changes and cleans its listener',()=>{
 localStorage.setItem('rifttask.appearance','invalid');let listener;const remove=vi.fn(),media={matches:false,addEventListener:vi.fn((_,fn)=>listener=fn),removeEventListener:remove};vi.stubGlobal('matchMedia',()=>media);const hook=renderHook(useAppearance);expect(hook.result.current.appearance).toBe('system');expect(document.documentElement.dataset.theme).toBe('light');act(()=>{media.matches=true;listener();});expect(document.documentElement.dataset.theme).toBe('dark');act(()=>hook.result.current.setAppearance('light'));act(()=>{media.matches=true;listener();});expect(document.documentElement.dataset.theme).toBe('light');hook.unmount();expect(remove).toHaveBeenCalledWith('change',expect.any(Function));
});
it('keeps appearance usable when browser storage is blocked',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});const hook=renderHook(useAppearance);act(()=>hook.result.current.setAppearance('dark'));expect(document.documentElement.dataset.theme).toBe('dark');hook.unmount();
});
