import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecurrencePreviewProps {
  recurrenceType: string;
  startDate?: string;
  endDate?: string;
  intervalValue?: number;
}

export function RecurrencePreview({ 
  recurrenceType, 
  startDate, 
  endDate, 
  intervalValue = 1 
}: RecurrencePreviewProps) {
  const [nextDates, setNextDates] = useState<Date[]>([]);

  const calculateNextDates = () => {
    if (!startDate || recurrenceType === 'pontual') {
      setNextDates([]);
      return;
    }

    const dates: Date[] = [];
    const start = new Date(startDate);
    
    // Set default time to 09:00
    start.setHours(9, 0, 0, 0);
    
    let currentDate = new Date(start);
    const now = new Date();
    
    // Skip to first future date
    while (currentDate <= now) {
      currentDate = getNextDate(currentDate, recurrenceType, intervalValue);
    }
    
    // Generate next 3 dates
    for (let i = 0; i < 3; i++) {
      if (endDate && currentDate > new Date(endDate)) {
        break;
      }
      
      dates.push(new Date(currentDate));
      currentDate = getNextDate(currentDate, recurrenceType, intervalValue);
    }
    
    setNextDates(dates);
  };

  const getNextDate = (currentDate: Date, recurrence: string, interval: number): Date => {
    const nextDate = new Date(currentDate);
    
    switch (recurrence.toLowerCase()) {
      case 'diaria':
        return addDays(nextDate, interval);
      case 'semanal':
        return addWeeks(nextDate, interval);
      case 'quinzenal':
        return addWeeks(nextDate, interval * 2);
      case 'mensal':
        const monthResult = addMonths(nextDate, interval);
        // Handle month edge cases (e.g., Jan 31 -> Feb 28)
        if (monthResult.getDate() !== currentDate.getDate()) {
          monthResult.setDate(0); // Last day of previous month
        }
        return monthResult;
      case 'semestral':
        const semesterResult = addMonths(nextDate, interval * 6);
        if (semesterResult.getDate() !== currentDate.getDate()) {
          semesterResult.setDate(0);
        }
        return semesterResult;
      case 'anual':
        const yearResult = addYears(nextDate, interval);
        if (yearResult.getDate() !== currentDate.getDate()) {
          yearResult.setDate(0);
        }
        return yearResult;
      default:
        return addDays(nextDate, 1);
    }
  };

  const getRecurrenceLabel = () => {
    const labels = {
      pontual: 'Pontual (execução única)',
      diaria: `Diária (a cada ${intervalValue} dia${intervalValue > 1 ? 's' : ''})`,
      semanal: `Semanal (a cada ${intervalValue} semana${intervalValue > 1 ? 's' : ''})`,
      quinzenal: `Quinzenal (a cada ${intervalValue * 2} semanas)`,
      mensal: `Mensal (a cada ${intervalValue} mês${intervalValue > 1 ? 'es' : ''})`,
      semestral: `Semestral (a cada ${intervalValue * 6} meses)`,
      anual: `Anual (a cada ${intervalValue} ano${intervalValue > 1 ? 's' : ''})`
    };
    return labels[recurrenceType as keyof typeof labels] || recurrenceType;
  };

  useEffect(() => {
    calculateNextDates();
  }, [recurrenceType, startDate, endDate, intervalValue]);

  if (!startDate || recurrenceType === 'pontual') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4" />
            Preview da Recorrência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            {recurrenceType === 'pontual' 
              ? 'Cobrança pontual - execução única no momento da criação'
              : 'Configure a data de início para ver o preview'
            }
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4" />
          Preview da Recorrência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Badge variant="outline" className="mb-2">
            {getRecurrenceLabel()}
          </Badge>
        </div>

        {nextDates.length > 0 ? (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Próximas 3 execuções
            </h4>
            <div className="space-y-2">
              {nextDates.map((date, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {index + 1}
                    </div>
                    <span className="font-medium">
                      {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(date, 'HH:mm', { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            {endDate && new Date(startDate) > new Date(endDate)
              ? 'Data final anterior à data de início'
              : 'Nenhuma execução futura encontrada'
            }
          </div>
        )}

        {endDate && (
          <div className="text-xs text-muted-foreground">
            <strong>Período:</strong> {format(new Date(startDate), 'dd/MM/yyyy', { locale: ptBR })} até {format(new Date(endDate), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}