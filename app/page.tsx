import ResultsHome from './components/results-home';
import { readPublicResults } from '../lib/results/read';
export const dynamic='force-dynamic';
export default async function Home(){return <ResultsHome initial={await readPublicResults()}/>;}
