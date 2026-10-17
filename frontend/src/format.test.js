import {describe,it,expect} from 'vitest';
import {titleCase,idOf,dateLabel} from './api';
describe('frontend format helpers',()=>{it('formats workflow enum labels',()=>expect(titleCase('IN_PROGRESS')).toBe('In Progress'));it('normalizes identifiers',()=>{expect(idOf({_id:'abc'})).toBe('abc');expect(idOf('xyz')).toBe('xyz');});it('handles invalid dates',()=>expect(dateLabel('not-a-date')).toBe('—'));});
