import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Textarea, 
  VStack, 
  Heading, 
  Text, 
  useToast, 
  Alert, 
  AlertIcon, 
  AlertTitle, 
  AlertDescription,
  Code,
  Badge,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';

const SAMPLE_FORMAT = `{
  "Q": 1,
  "question": "Sample multiple choice question (a) Option 1 (b) Option 2 (c) Option 3 (d) Option 4",
  "question_answered": false,
  "question_marks": 2,
  "marks_gained": 0
}
{
  "Q": 2,
  "question": "Sample short answer question",
  "question_answered": false,
  "question_marks": 3,
  "marks_gained": 0
}`;

const QuestionBatchUploader = ({ onSuccess }) => {
  const { chapterId } = useParams();
  const [batchText, setBatchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!batchText.trim()) {
      setError('Please enter batch question data');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setResult(null);
      
      const response = await api.post(`/admin/chapters/${chapterId}/process-questions`, {
        batchText
      });
      
      setResult(response.data);
      
      toast({
        title: 'Success!',
        description: `Processed ${response.data.totalQuestions} questions`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      if (onSuccess) {
        onSuccess(response.data.questions);
      }
      
    } catch (err) {
      console.error('Error processing batch:', err);
      setError(err.response?.data?.error || 'Failed to process batch questions');
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Something went wrong',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadSampleData = () => {
    setBatchText(SAMPLE_FORMAT);
  };
  
  const clearForm = () => {
    setBatchText('');
    setResult(null);
    setError('');
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg" bg="white" shadow="md">
      <Heading size="md" mb={4}>Batch Question Uploader</Heading>
      
      <Text mb={4}>
        Upload multiple questions at once by entering each question as a JSON object on a separate line.
        <Badge colorScheme="purple" ml={2}>Beta</Badge>
      </Text>
      
      <Accordion allowToggle mb={4}>
        <AccordionItem>
          <h2>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                Format Instructions
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
            <Text mb={2}>Each question should be a valid JSON object with the following fields:</Text>
            <Text as="div" fontSize="sm" mb={3}>
              <Code>Q</Code>: Question number (required)<br />
              <Code>question</Code>: Question text (required)<br />
              <Code>question_answered</Code>: Boolean indicating if question is answered (default: false)<br />
              <Code>question_marks</Code>: Maximum marks for the question (default: 1)<br />
              <Code>marks_gained</Code>: Marks gained so far (default: 0)
            </Text>
            <Button size="sm" colorScheme="blue" onClick={loadSampleData}>
              Load Sample Format
            </Button>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <Textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="Paste JSON question data here, one question per line"
            size="lg"
            minHeight="300px"
            fontFamily="monospace"
          />
          
          <Box display="flex" justifyContent="space-between">
            <Button 
              colorScheme="red" 
              variant="outline" 
              onClick={clearForm}
              isDisabled={isLoading || !batchText}
            >
              Clear
            </Button>
            
            <Button 
              colorScheme="green" 
              type="submit" 
              isLoading={isLoading}
              loadingText="Processing"
              isDisabled={!batchText}
            >
              Process Batch
            </Button>
          </Box>
        </VStack>
      </form>

      {isLoading && (
        <Box textAlign="center" mt={4}>
          <Spinner size="xl" />
          <Text mt={2}>Processing questions...</Text>
        </Box>
      )}

      {result && (
        <Box mt={6} p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
          <Heading size="sm" mb={2}>Result</Heading>
          <Text>Successfully processed {result.totalQuestions} questions</Text>
          {result.errorCount > 0 && (
            <Text color="orange.500">
              {result.errorCount} questions had errors and were skipped
            </Text>
          )}
          
          <Accordion allowToggle mt={4}>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    View Processed Questions
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4} maxHeight="300px" overflowY="auto">
                <pre>{JSON.stringify(result.questions, null, 2)}</pre>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>
      )}
    </Box>
  );
};

export default QuestionBatchUploader; 